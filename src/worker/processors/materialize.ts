import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/db";
import { getEnv } from "../../lib/env";
import { childLogger } from "../../lib/logger";
import { enqueueSendJobs } from "../../lib/queue/queues";
import { eligibleAudienceWhere, type AudienceConfig, type SegmentFilter } from "../../lib/campaigns/audience";
import { flattenPersonalization } from "../../lib/email/render";
import { refreshCampaignStats } from "../../lib/campaigns/stats";
import type { MaterializeJobData } from "../../lib/queue/types";

const log = childLogger({ module: "materialize" });

export async function processMaterialize(data: MaterializeJobData) {
  const send = await prisma.campaignSend.findUnique({
    where: { id: data.campaignSendId },
    include: { campaign: { include: { segment: true } } },
  });
  if (!send) throw new Error("Campaign send not found");
  if (send.status === "CANCELLED" || send.campaign.status === "CANCELLED") {
    log.info({ campaignSendId: send.id }, "skip materialize; cancelled");
    return;
  }

  const env = getEnv();
  const batchSize = env.EMAIL_BATCH_SIZE;
  const where = await eligibleAudienceWhere({
    audienceType: send.campaign.audienceType,
    audienceConfig: send.campaign.audienceConfig as AudienceConfig,
    segmentFilter: (send.campaign.segment?.filter as SegmentFilter) ?? null,
  });

  let cursor: string | undefined;
  let created = 0;
  const pendingJobBuffer: { campaignRecipientId: string; campaignSendId: string; idempotencyKey: string }[] = [];

  for (;;) {
    const page = await prisma.contact.findMany({
      where,
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      include: { tags: { include: { tag: true } } },
    });
    if (page.length === 0) break;
    cursor = page[page.length - 1].id;

    const rows = page.map((contact) => {
      const custom =
        contact.customFields && typeof contact.customFields === "object"
          ? (contact.customFields as Record<string, unknown>)
          : {};
      const personalization = flattenPersonalization(
        {
          email: contact.email,
          firstName: contact.firstName ?? "",
          lastName: contact.lastName ?? "",
          company: contact.company ?? "",
          phone: contact.phone ?? "",
        },
        custom,
      );
      return {
        campaignSendId: send.id,
        contactId: contact.id,
        email: contact.email,
        emailNormalized: contact.emailNormalized,
        personalization: personalization as Prisma.InputJsonValue,
        status: "PENDING" as const,
        idempotencyKey: `${send.id}:${contact.emailNormalized}`,
      };
    });

    await prisma.campaignRecipient.createMany({ data: rows, skipDuplicates: true });
    created += rows.length;

    const inserted = await prisma.campaignRecipient.findMany({
      where: {
        campaignSendId: send.id,
        emailNormalized: { in: rows.map((r) => r.emailNormalized) },
        status: { in: ["PENDING", "QUEUED"] },
      },
      select: { id: true, idempotencyKey: true, status: true },
    });
    pendingJobBuffer.push(
      ...inserted.map((r) => ({
        campaignRecipientId: r.id,
        campaignSendId: send.id,
        idempotencyKey: r.idempotencyKey,
      })),
    );

    if (send.cancelAfter && send.cancelAfter.getTime() > Date.now()) {
      continue;
    }

    if (pendingJobBuffer.length >= batchSize) {
      await markQueuedAndEnqueue(pendingJobBuffer.splice(0, pendingJobBuffer.length), send.id);
    }
  }

  const waitMs = send.cancelAfter ? send.cancelAfter.getTime() - Date.now() : 0;
  if (waitMs > 0) {
    await prisma.campaignSend.update({
      where: { id: send.id },
      data: { eligibleCount: created },
    });
    await refreshCampaignStats(send.id);
    log.info({ campaignSendId: send.id, waitMs, created }, "waiting for cancellation window");
    await new Promise((r) => setTimeout(r, waitMs));
    const latest = await prisma.campaignSend.findUnique({ where: { id: send.id } });
    if (!latest || latest.status === "CANCELLED") {
      log.info({ campaignSendId: send.id }, "cancelled during window");
      return;
    }
  }

  if (pendingJobBuffer.length) {
    await markQueuedAndEnqueue(pendingJobBuffer, send.id);
  }

  await prisma.campaignSend.update({
    where: { id: send.id },
    data: {
      eligibleCount: created,
      status: created === 0 ? "COMPLETED" : "QUEUED",
    },
  });
  await prisma.campaign.update({
    where: { id: send.campaignId },
    data: {
      statsEligible: created,
      status: created === 0 ? "COMPLETED" : "QUEUED",
    },
  });
  await refreshCampaignStats(send.id);
  log.info({ campaignSendId: send.id, campaignId: send.campaignId, created }, "materialize complete");
}

async function markQueuedAndEnqueue(
  items: { campaignRecipientId: string; campaignSendId: string; idempotencyKey: string }[],
  campaignSendId: string,
) {
  await prisma.campaignRecipient.updateMany({
    where: { id: { in: items.map((i) => i.campaignRecipientId) }, status: "PENDING" },
    data: { status: "QUEUED", queuedAt: new Date() },
  });
  try {
    await enqueueSendJobs(items);
  } catch (error) {
    log.error(
      { err: error instanceof Error ? error.message : String(error), campaignSendId },
      "enqueue send jobs failed; reconciliation will retry",
    );
  }
}
