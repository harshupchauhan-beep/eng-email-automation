import { DeliveryStatus, Prisma, SuppressionReason } from "@prisma/client";
import { prisma } from "../db";
import { normalizeEmail } from "../crypto";
import { suppressAddress } from "./suppression";
import { refreshCampaignStats } from "../campaigns/stats";
import { childLogger } from "../logger";

const log = childLogger({ module: "email-events" });

export type NormalizedEvent = {
  provider: string;
  providerEventId: string;
  type:
    | "delivered"
    | "bounced"
    | "deferred"
    | "rejected"
    | "complained"
    | "opened"
    | "clicked"
    | "unsubscribed";
  email: string;
  providerMessageId?: string;
  campaignRecipientId?: string;
  bounceType?: "hard" | "soft";
  payload: Record<string, unknown>;
};

export async function applyNormalizedEvent(event: NormalizedEvent) {
  try {
    await prisma.emailEvent.create({
      data: {
        provider: event.provider,
        providerEventId: event.providerEventId,
        type: event.type,
        emailNormalized: normalizeEmail(event.email),
        campaignRecipientId: event.campaignRecipientId,
        payload: event.payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      log.info({ providerEventId: event.providerEventId }, "duplicate webhook ignored");
      return { duplicate: true };
    }
    throw error;
  }

  const recipient = await findRecipient(event);
  if (recipient && !event.campaignRecipientId) {
    await prisma.emailEvent.update({
      where: { providerEventId: event.providerEventId },
      data: { campaignRecipientId: recipient.id },
    });
  }

  switch (event.type) {
    case "delivered":
      if (recipient) await setRecipientStatus(recipient.id, "DELIVERED", { deliveredAt: new Date() });
      break;
    case "deferred":
      if (recipient && recipient.status === "SENT") {
        await setRecipientStatus(recipient.id, "DEFERRED", {});
      }
      break;
    case "rejected":
      if (recipient) {
        await setRecipientStatus(recipient.id, "REJECTED", {
          failureCategory: "PROVIDER_REJECTED",
          failureReason: "provider_rejected",
        });
      }
      break;
    case "bounced":
      if (event.bounceType !== "soft") {
        await suppressAddress({
          email: event.email,
          reason: "HARD_BOUNCE" as SuppressionReason,
          source: `${event.provider}:bounce`,
        });
        if (recipient) {
          await setRecipientStatus(recipient.id, "BOUNCED", { bouncedAt: new Date() });
        }
      } else if (recipient) {
        await setRecipientStatus(recipient.id, "DEFERRED", {});
      }
      break;
    case "complained":
      await suppressAddress({
        email: event.email,
        reason: "COMPLAINT",
        source: `${event.provider}:complaint`,
      });
      if (recipient) {
        await setRecipientStatus(recipient.id, "COMPLAINED", { complainedAt: new Date() });
      }
      break;
    case "unsubscribed":
      await suppressAddress({
        email: event.email,
        reason: "UNSUBSCRIBE",
        source: `${event.provider}:unsubscribe`,
      });
      if (recipient) {
        await setRecipientStatus(recipient.id, "CANCELLED", { unsubscribedAt: new Date() });
      }
      break;
    default:
      break;
  }

  if (recipient) await refreshCampaignStats(recipient.campaignSendId);
  return { duplicate: false };
}

async function findRecipient(event: NormalizedEvent) {
  if (event.campaignRecipientId) {
    return prisma.campaignRecipient.findUnique({ where: { id: event.campaignRecipientId } });
  }
  if (event.providerMessageId) {
    const byMessage = await prisma.campaignRecipient.findFirst({
      where: { providerMessageId: event.providerMessageId },
    });
    if (byMessage) return byMessage;
  }
  return prisma.campaignRecipient.findFirst({
    where: {
      emailNormalized: normalizeEmail(event.email),
      status: { in: ["SENT", "DELIVERED", "DEFERRED", "PROCESSING"] },
    },
    orderBy: { sentAt: "desc" },
  });
}

async function setRecipientStatus(
  id: string,
  status: DeliveryStatus,
  extra: Prisma.CampaignRecipientUpdateInput,
) {
  await prisma.campaignRecipient.update({
    where: { id },
    data: { status, ...extra },
  });
}
