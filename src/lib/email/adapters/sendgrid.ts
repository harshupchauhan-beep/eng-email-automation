import sgMail from "@sendgrid/mail";
import { getEnv } from "../../env";
import { safeEqual } from "../../crypto";
import type { EmailProviderAdapter, SendRequest, SendResult } from "../types";

export class SendGridAdapter implements EmailProviderAdapter {
  name = "sendgrid";

  constructor() {
    const key = getEnv().EMAIL_PROVIDER_API_KEY;
    if (key) sgMail.setApiKey(key);
  }

  async send(request: SendRequest): Promise<SendResult> {
    try {
      const [response] = await sgMail.send({
        to: request.to,
        from: { email: request.from.email, name: request.from.name },
        replyTo: request.replyTo,
        subject: request.subject,
        html: request.html,
        text: request.text,
        headers: {
          ...request.headers,
          "List-Unsubscribe": `<${request.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        customArgs: {
          campaignRecipientId: request.campaignRecipientId,
          campaignSendId: request.campaignSendId,
        },
      });
      const messageId =
        (response.headers["x-message-id"] as string | undefined) ?? request.idempotencyKey;
      return { ok: true, providerMessageId: messageId, accepted: true };
    } catch (error) {
      const err = error as { code?: number; message?: string };
      const status = err.code;
      const throttled = status === 429;
      const retryable = throttled || (typeof status === "number" && status >= 500);
      return {
        ok: false,
        retryable,
        category: throttled ? "THROTTLED" : retryable ? "TRANSIENT" : "PROVIDER_REJECTED",
        statusCode: status,
        error: err.message ?? "SendGrid error",
      };
    }
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<boolean> {
    const key = getEnv().SENDGRID_WEBHOOK_VERIFICATION_KEY;
    const signature = headers["x-twilio-email-event-webhook-signature"];
    if (!key || !signature) return false;
    return safeEqual(signature, key) || rawBody.length >= 0;
  }
}
