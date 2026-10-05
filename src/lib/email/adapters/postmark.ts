import { ServerClient } from "postmark";
import { getEnv } from "../../env";
import { safeEqual } from "../../crypto";
import type { EmailProviderAdapter, SendRequest, SendResult } from "../types";

export class PostmarkAdapter implements EmailProviderAdapter {
  name = "postmark";
  private client: ServerClient | null;

  constructor() {
    const token = getEnv().POSTMARK_SERVER_TOKEN ?? getEnv().EMAIL_PROVIDER_API_KEY;
    this.client = token ? new ServerClient(token) : null;
  }

  async send(request: SendRequest): Promise<SendResult> {
    if (!this.client) {
      return {
        ok: false,
        retryable: false,
        category: "PROVIDER_REJECTED",
        error: "Postmark token is not configured",
      };
    }
    try {
      const result = await this.client.sendEmail({
        From: request.from.name
          ? `${request.from.name} <${request.from.email}>`
          : request.from.email,
        To: request.to,
        ReplyTo: request.replyTo,
        Subject: request.subject,
        HtmlBody: request.html,
        TextBody: request.text,
        MessageStream: "broadcast",
        Headers: [
          { Name: "List-Unsubscribe", Value: `<${request.unsubscribeUrl}>` },
          { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
        ],
        Metadata: {
          campaignRecipientId: request.campaignRecipientId,
          campaignSendId: request.campaignSendId,
        },
      });
      return {
        ok: true,
        providerMessageId: result.MessageID ?? request.idempotencyKey,
        accepted: true,
      };
    } catch (error) {
      const err = error as { statusCode?: number; message?: string; code?: number };
      const status = err.statusCode ?? err.code;
      const throttled = status === 429;
      const retryable = throttled || (typeof status === "number" && status >= 500);
      return {
        ok: false,
        retryable,
        category: throttled ? "THROTTLED" : retryable ? "TRANSIENT" : "PROVIDER_REJECTED",
        statusCode: status,
        error: err.message ?? "Postmark error",
      };
    }
  }

  async verifyWebhook(_rawBody: string, headers: Record<string, string>): Promise<boolean> {
    const token = getEnv().POSTMARK_WEBHOOK_TOKEN ?? getEnv().WEBHOOK_SECRET;
    const provided = headers["x-postmark-webhook-token"] ?? headers["authorization"];
    if (!token || !provided) return false;
    return safeEqual(provided.replace(/^Bearer\s+/i, ""), token);
  }
}
