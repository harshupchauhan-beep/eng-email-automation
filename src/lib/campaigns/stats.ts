import { DeliveryStatus } from "@prisma/client";
import { prisma } from "../db";

const SENT_LIKE: DeliveryStatus[] = ["SENT", "DELIVERED", "DEFERRED"];

export async function refreshCampaignStats(campaignSendId: string) {
  const grouped = await prisma.campaignRecipient.groupBy({
    by: ["status"],
    where: { campaignSendId },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all])) as Record<
    string,
    number
  >;
  const queued = (counts.PENDING ?? 0) + (counts.QUEUED ?? 0);
  const processing = counts.PROCESSING ?? 0;
  const sent = (counts.SENT ?? 0) + (counts.DELIVERED ?? 0) + (counts.DEFERRED ?? 0);
  const delivered = counts.DELIVERED ?? 0;
  const failed = (counts.FAILED ?? 0) + (counts.REJECTED ?? 0);
  const bounced = counts.BOUNCED ?? 0;
  const complained = counts.COMPLAINED ?? 0;
  const unsubscribed = counts.CANCELLED ?? 0;
  const suppressed = (counts.SUPPRESSED ?? 0) + (counts.SKIPPED ?? 0);

  const send = await prisma.campaignSend.findUnique({
    where: { id: campaignSendId },
    select: { campaignId: true, status: true, eligibleCount: true },
  });
  if (!send) return;

  const remaining = queued + processing;
  const finished = remaining === 0 && send.eligibleCount > 0 && send.status !== "QUEUING";
  let nextStatus = send.status;
  if (send.status === "CANCELLED") {
    nextStatus = "CANCELLED";
  } else if (send.status === "PAUSED") {
    nextStatus = "PAUSED";
  } else if (finished) {
    nextStatus = failed > 0 || bounced > 0 ? "PARTIALLY_FAILED" : "COMPLETED";
  } else if (send.status === "QUEUING" && queued + processing + sent > 0) {
    nextStatus = "QUEUED";
  } else if (sent > 0 || processing > 0) {
    nextStatus = "SENDING";
  }

  await prisma.$transaction([
    prisma.campaignSend.update({
      where: { id: campaignSendId },
      data: {
        status: nextStatus,
        completedAt: finished ? new Date() : undefined,
        startedAt: sent + processing > 0 ? new Date() : undefined,
      },
    }),
    prisma.campaign.update({
      where: { id: send.campaignId },
      data: {
        status: nextStatus,
        statsQueued: queued,
        statsProcessing: processing,
        statsSent: sent,
        statsDelivered: delivered,
        statsFailed: failed,
        statsBounced: bounced,
        statsComplained: complained,
        statsUnsubscribed: unsubscribed,
        statsSuppressed: suppressed,
      },
    }),
  ]);
}

export { SENT_LIKE };
