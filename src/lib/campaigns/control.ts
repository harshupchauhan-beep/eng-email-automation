import { DeliveryStatus } from "@prisma/client";
import { prisma } from "../db";
import { writeAuditLog } from "../audit";
import { childLogger } from "../logger";
import { isTerminal } from "./send";

const log = childLogger({ module: "campaign-control" });

export async function pauseCampaign(campaignId: string, userId: string, ip?: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { send: true },
  });
  if (!campaign?.send) throw new Error("Campaign send not found");
  if (!["QUEUING", "QUEUED", "SENDING"].includes(campaign.status)) {
    throw new Error("Campaign cannot be paused in its current state");
  }
  await prisma.$transaction([
    prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "PAUSED" },
    }),
    prisma.campaignSend.update({
      where: { id: campaign.send.id },
      data: { status: "PAUSED", pausedAt: new Date() },
    }),
  ]);
  await writeAuditLog({
    userId,
    action: "campaign.pause",
    entityType: "Campaign",
    entityId: campaignId,
    ipAddress: ip,
  });
  log.info({ campaignId }, "campaign paused");
}

export async function resumeCampaign(campaignId: string, userId: string, ip?: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { send: true },
  });
  if (!campaign?.send || campaign.status !== "PAUSED") {
    throw new Error("Campaign is not paused");
  }
  await prisma.$transaction([
    prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "SENDING" },
    }),
    prisma.campaignSend.update({
      where: { id: campaign.send.id },
      data: { status: "SENDING", pausedAt: null },
    }),
  ]);
  await writeAuditLog({
    userId,
    action: "campaign.resume",
    entityType: "Campaign",
    entityId: campaignId,
    ipAddress: ip,
  });
  log.info({ campaignId }, "campaign resumed");
}

export async function cancelCampaign(campaignId: string, userId: string, ip?: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { send: true },
  });
  if (!campaign?.send) throw new Error("Campaign send not found");
  if (isTerminal(campaign.status)) throw new Error("Campaign already finished");

  const cancellable: DeliveryStatus[] = ["PENDING", "QUEUED"];
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.campaignRecipient.updateMany({
      where: {
        campaignSendId: campaign.send!.id,
        status: { in: cancellable },
      },
      data: { status: "CANCELLED" },
    });
    await tx.campaignSend.update({
      where: { id: campaign.send!.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await tx.campaign.update({
      where: { id: campaignId },
      data: { status: "CANCELLED" },
    });
    return updated.count;
  });

  await writeAuditLog({
    userId,
    action: "campaign.cancel",
    entityType: "Campaign",
    entityId: campaignId,
    ipAddress: ip,
    metadata: { cancelledRecipients: result },
  });
  log.info({ campaignId, cancelledRecipients: result }, "campaign cancelled");
  return { cancelledRecipients: result };
}
