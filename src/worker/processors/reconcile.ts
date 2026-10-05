import { prisma } from "../../lib/db";
import { getEnv } from "../../lib/env";
import { childLogger } from "../../lib/logger";
import { enqueueSendJobs } from "../../lib/queue/queues";
import { startScheduledCampaign } from "../../lib/campaigns/send";
import { refreshCampaignStats } from "../../lib/campaigns/stats";

const log = childLogger({ module: "reconcile" });

export async function processReconcile() {
  const env = getEnv();
  const stuckBefore = new Date(Date.now() - env.STUCK_PROCESSING_MS);

  const stuck = await prisma.campaignRecipient.findMany({
    where: {
      status: { in: ["PROCESSING", "QUEUED", "PENDING"] },
      campaignSend: { status: { in: ["QUEUING", "QUEUED", "SENDING"] } },
      OR: [
        { status: "PROCESSING", attemptedAt: { lt: stuckBefore } },
        { status: { in: ["QUEUED", "PENDING"] }, queuedAt: { lt: stuckBefore } },
        { status: "QUEUED", queuedAt: null },
      ],
    },
    take: env.EMAIL_BATCH_SIZE,
    select: { id: true, campaignSendId: true, idempotencyKey: true, status: true },
  });

  if (stuck.length) {
    const processing = stuck.filter((s) => s.status === "PROCESSING");
    if (processing.length) {
      await prisma.campaignRecipient.updateMany({
        where: { id: { in: processing.map((s) => s.id) } },
        data: { status: "QUEUED" },
      });
    }
    await enqueueSendJobs(
      stuck.map((s) => ({
        campaignRecipientId: s.id,
        campaignSendId: s.campaignSendId,
        idempotencyKey: s.idempotencyKey,
      })),
    );
    log.info({ count: stuck.length }, "requeued stuck deliveries");
  }

  const due = await prisma.campaign.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: new Date() },
    },
    select: { id: true },
    take: 25,
  });
  for (const campaign of due) {
    await startScheduledCampaign(campaign.id);
  }

  const activeSends = await prisma.campaignSend.findMany({
    where: { status: { in: ["QUEUING", "QUEUED", "SENDING"] } },
    select: { id: true },
    take: 20,
  });
  for (const send of activeSends) {
    await refreshCampaignStats(send.id);
  }

  await prisma.workerHeartbeat.upsert({
    where: { id: "primary" },
    create: {
      id: "primary",
      hostname: process.env.HOSTNAME ?? "worker",
      pid: process.pid,
      lastSeenAt: new Date(),
      metadata: { requeued: stuck.length, scheduledStarted: due.length },
    },
    update: {
      hostname: process.env.HOSTNAME ?? "worker",
      pid: process.pid,
      lastSeenAt: new Date(),
      metadata: { requeued: stuck.length, scheduledStarted: due.length },
    },
  });
}
