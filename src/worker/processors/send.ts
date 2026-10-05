import { DeliveryStatus, FailureCategory } from "@prisma/client";
import { prisma } from "../../lib/db";
import { getEnv } from "../../lib/env";
import { childLogger } from "../../lib/logger";
import { jitter } from "../../lib/crypto";
import { isSuppressed } from "../../lib/email/suppression";
import { getEmailProvider } from "../../lib/email/provider";
import { appendUnsubscribeAndIdentity, renderEmail } from "../../lib/email/render";
import { unsubscribeUrl } from "../../lib/email/unsubscribe";
import { refreshCampaignStats } from "../../lib/campaigns/stats";
import type { SendJobData } from "../../lib/queue/types";
import type { SendResult } from "../../lib/email/types";

const log = childLogger({ module: "send-worker" });

const FINAL: DeliveryStatus[] = [
  "SENT",
  "DELIVERED",
  "BOUNCED",
  "COMPLAINED",
  "REJECTED",
  "CANCELLED",
  "SUPPRESSED",
  "SKIPPED",
];

export class RetryableSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableSendError";
  }
}

export async function processSend(data: SendJobData) {
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: data.campaignRecipientId },
    include: { campaignSend: { include: { campaign: true } } },
  });
  if (!recipient) {
    log.warn({ campaignRecipientId: data.campaignRecipientId }, "recipient missing");
    return;
  }

  const campaignStatus = recipient.campaignSend.campaign.status;
  if (campaignStatus === "PAUSED") {
    throw new RetryableSendError("Campaign paused");
  }
  if (campaignStatus === "CANCELLED" || recipient.status === "CANCELLED") {
    if (recipient.status !== "CANCELLED") {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "CANCELLED" },
      });
    }
    return;
  }
  if (FINAL.includes(recipient.status) && recipient.status !== "FAILED") {
    log.info(
      { campaignRecipientId: recipient.id, status: recipient.status },
      "skip already completed recipient",
    );
    return;
  }

  if (await isSuppressed(recipient.emailNormalized)) {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: "SUPPRESSED", failureCategory: "SUPPRESSED", failureReason: "suppressed" },
    });
    await refreshCampaignStats(recipient.campaignSendId);
    return;
  }

  const claimed = await prisma.campaignRecipient.updateMany({
    where: {
      id: recipient.id,
      status: { in: ["QUEUED", "PENDING", "FAILED"] },
    },
    data: {
      status: "PROCESSING",
      attemptedAt: new Date(),
      attemptCount: { increment: 1 },
    },
  });
  if (claimed.count !== 1) {
    log.info({ campaignRecipientId: recipient.id }, "could not claim recipient");
    return;
  }

  const send = recipient.campaignSend;
  const vars = (recipient.personalization ?? {}) as Record<string, string>;
  const fallbacks = (send.fallbacks ?? {}) as Record<string, string>;
  const rendered = renderEmail({
    subject: send.subjectTemplate,
    preheader: send.preheaderTemplate,
    html: send.htmlTemplate,
    text: send.textTemplate,
    vars,
    fallbacks,
  });
  const unsub = unsubscribeUrl(recipient.id);
  const withFooter = appendUnsubscribeAndIdentity({
    html: rendered.html,
    text: rendered.text,
    unsubscribeUrl: unsub,
    companyName: send.companyName ?? getEnv().ORG_NAME,
    physicalAddress: send.physicalAddress ?? getEnv().ORG_PHYSICAL_ADDRESS,
  });

  const provider = getEmailProvider();
  let result: SendResult;
  try {
    result = await provider.send({
      to: recipient.email,
      from: { email: send.fromEmail, name: send.fromName },
      replyTo: send.replyTo ?? undefined,
      subject: rendered.subject,
      html: withFooter.html,
      text: withFooter.text,
      idempotencyKey: recipient.idempotencyKey,
      campaignRecipientId: recipient.id,
      campaignSendId: send.id,
      unsubscribeUrl: unsub,
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  } catch (error) {
    result = {
      ok: false,
      retryable: true,
      category: "TRANSIENT",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const attemptNumber = recipient.attemptCount + 1;
  if (result.ok) {
    await prisma.$transaction([
      prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.providerMessageId,
          lastError: null,
          failureCategory: null,
        },
      }),
      prisma.emailDelivery.create({
        data: {
          campaignRecipientId: recipient.id,
          attemptNumber,
          provider: provider.name,
          providerMessageId: result.providerMessageId,
          status: "SENT",
        },
      }),
    ]);
    await refreshCampaignStats(send.id);
    log.info(
      {
        campaignId: send.campaignId,
        campaignSendId: send.id,
        campaignRecipientId: recipient.id,
        providerMessageId: result.providerMessageId,
      },
      "email accepted by provider",
    );
    return;
  }

  const category: FailureCategory =
    result.category === "THROTTLED" || result.category === "TRANSIENT"
      ? "TRANSIENT"
      : result.category === "PROVIDER_REJECTED"
        ? "PROVIDER_REJECTED"
        : "PERMANENT";
  const retryable = result.retryable && category === "TRANSIENT";
  const env = getEnv();
  const nextRetryAt = retryable
    ? new Date(Date.now() + jitter(env.EMAIL_RETRY_BASE_MS, attemptNumber))
    : null;

  await prisma.$transaction([
    prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: retryable ? "QUEUED" : "FAILED",
        failureCategory: category,
        failureReason: result.error.slice(0, 500),
        lastError: result.error.slice(0, 1000),
        nextRetryAt,
      },
    }),
    prisma.emailDelivery.create({
      data: {
        campaignRecipientId: recipient.id,
        attemptNumber,
        provider: provider.name,
        status: retryable ? "DEFERRED" : "FAILED",
        failureCategory: category,
        responseCode: result.statusCode,
        errorMessage: result.error.slice(0, 1000),
      },
    }),
  ]);
  await refreshCampaignStats(send.id);

  if (retryable) {
    if (result.category === "THROTTLED") {
      await new Promise((r) => setTimeout(r, 1000 + Math.floor(Math.random() * 500)));
    }
    throw new RetryableSendError(result.error);
  }
}
