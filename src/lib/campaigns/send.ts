import { CampaignStatus, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getEnv } from "../env";
import { enqueueMaterialize, enqueueScheduled } from "../queue/queues";
import { writeAuditLog } from "../audit";
import { estimateAudience, type AudienceConfig } from "./audience";
import { childLogger } from "../logger";

const log = childLogger({ module: "campaign-send" });

export class SendConflictError extends Error {
  existingSendId: string;
  constructor(existingSendId: string) {
    super("Campaign send already exists");
    this.existingSendId = existingSendId;
  }
}

export async function initiateCampaignSend(input: {
  campaignId: string;
  userId: string;
  idempotencyKey: string;
  ipAddress?: string;
}) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    include: {
      template: { include: { currentVersion: true } },
      segment: true,
      send: true,
    },
  });
  if (!campaign) throw new Error("Campaign not found");

  if (campaign.send) {
    if (campaign.send.idempotencyKey === input.idempotencyKey || campaign.status !== "DRAFT") {
      return { campaignSend: campaign.send, replayed: true };
    }
    throw new SendConflictError(campaign.send.id);
  }

  if (!["DRAFT", "READY", "SCHEDULED"].includes(campaign.status)) {
    throw new Error(`Campaign cannot be sent from status ${campaign.status}`);
  }

  const version = campaign.template?.currentVersion;
  if (!version && !campaign.subject) {
    throw new Error("Campaign is missing template content");
  }

  const htmlTemplate = version?.htmlBody ?? "";
  const textTemplate = version?.textBody ?? "";
  const subjectTemplate = campaign.subject || version?.subject || "";
  const preheaderTemplate = campaign.preheader ?? version?.preheader ?? "";
  if (!htmlTemplate || !subjectTemplate) {
    throw new Error("Campaign template is incomplete");
  }

  const env = getEnv();
  const settings = await prisma.setting.findMany({
    where: { key: { in: ["orgName", "physicalAddress"] } },
  });
  const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const companyName =
    (typeof settingMap.orgName === "string" ? settingMap.orgName : null) ?? env.ORG_NAME;
  const physicalAddress =
    (typeof settingMap.physicalAddress === "string" ? settingMap.physicalAddress : null) ??
    env.ORG_PHYSICAL_ADDRESS;

  const estimates = await estimateAudience({
    audienceType: campaign.audienceType,
    audienceConfig: campaign.audienceConfig as AudienceConfig,
    segmentId: campaign.segmentId,
  });

  const now = new Date();
  const cancelAfter = new Date(now.getTime() + campaign.cancellationWindowSeconds * 1000);
  const scheduled = Boolean(campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now());

  try {
    const send = await prisma.$transaction(async (tx) => {
      const created = await tx.campaignSend.create({
        data: {
          campaignId: campaign.id,
          idempotencyKey: input.idempotencyKey,
          status: scheduled ? "SCHEDULED" : "QUEUING",
          fromName: campaign.fromName,
          fromEmail: campaign.fromEmail,
          replyTo: campaign.replyTo,
          subjectTemplate,
          preheaderTemplate,
          htmlTemplate,
          textTemplate,
          fallbacks: (version?.fallbacks as Prisma.InputJsonValue) ?? {},
          physicalAddress,
          companyName,
          audienceSnapshot: estimates as Prisma.InputJsonValue,
          eligibleCount: estimates.estimatedEligible,
          suppressedCount: estimates.suppressed,
          invalidCount: estimates.invalid,
          cancelAfter: scheduled ? null : cancelAfter,
          queuedAt: scheduled ? null : now,
        },
      });
      await tx.campaign.update({
        where: { id: campaign.id },
        data: {
          status: scheduled ? "SCHEDULED" : "QUEUING",
          statsEligible: estimates.estimatedEligible,
          statsSuppressed: estimates.suppressed,
          statsInvalid: estimates.invalid,
          statsSelected: estimates.totalSelected,
        },
      });
      return created;
    });

    await writeAuditLog({
      userId: input.userId,
      action: scheduled ? "campaign.schedule" : "campaign.send",
      entityType: "Campaign",
      entityId: campaign.id,
      ipAddress: input.ipAddress,
      metadata: {
        campaignSendId: send.id,
        eligible: estimates.estimatedEligible,
        scheduledAt: campaign.scheduledAt,
      },
    });

    if (scheduled && campaign.scheduledAt) {
      await enqueueScheduled(campaign.id, campaign.scheduledAt);
    } else {
      await enqueueMaterialize({ campaignSendId: send.id, campaignId: campaign.id });
    }

    log.info(
      { campaignId: campaign.id, campaignSendId: send.id, scheduled },
      "campaign send initiated",
    );
    return { campaignSend: send, replayed: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.campaignSend.findUnique({
        where: { campaignId: input.campaignId },
      });
      if (existing) return { campaignSend: existing, replayed: true };
    }
    throw error;
  }
}

export async function startScheduledCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { send: true },
  });
  if (!campaign?.send) return;
  if (campaign.status !== "SCHEDULED") return;
  const env = getEnv();
  const cancelAfter = new Date(Date.now() + campaign.cancellationWindowSeconds * 1000);
  await prisma.$transaction([
    prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "QUEUING" },
    }),
    prisma.campaignSend.update({
      where: { id: campaign.send.id },
      data: { status: "QUEUING", queuedAt: new Date(), cancelAfter },
    }),
  ]);
  await enqueueMaterialize({ campaignSendId: campaign.send.id, campaignId });
  log.info({ campaignId, windowSeconds: env.CAMPAIGN_CANCELLATION_WINDOW_SECONDS }, "scheduled campaign queued");
}

const TERMINAL: CampaignStatus[] = ["COMPLETED", "PARTIALLY_FAILED", "FAILED", "CANCELLED"];

export function isTerminal(status: CampaignStatus) {
  return TERMINAL.includes(status);
}
