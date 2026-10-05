import FormData from "form-data";
import Mailgun from "mailgun.js";
import { createHmac } from "node:crypto";
import { getEnv } from "../../env";
import { safeEqual } from "../../crypto";
import type { EmailProviderAdapter, SendRequest, SendResult } from "../types";

export class MailgunAdapter implements EmailProviderAdapter {
  name = "mailgun";
  private client: ReturnType<InstanceType<typeof Mailgun>["client"]>;

  constructor() {
    const mg = new Mailgun(FormData);
    this.client = mg.client({
      username: "api",
      key: getEnv().EMAIL_PROVIDER_API_KEY ?? "",
    });
  }

  async send(request: SendRequest): Promise<SendResult> {
    const env = getEnv();
    const domain = env.MAILGUN_DOMAIN;
    if (!domain) {
      return {
        ok: false,
        retryable: false,
        category: "PROVIDER_REJECTED",
        error: "MAILGUN_DOMAIN is not configured",
      };
    }
    try {
      const result = await this.client.messages.create(domain, {
        from: request.from.name
          ? `${request.from.name} <${request.from.email}>`
          : request.from.email,
        to: [request.to],
        "h:Reply-To": request.replyTo,
        subject: request.subject,
        html: request.html,
        text: request.text,
        "h:List-Unsubscribe": `<${request.unsubscribeUrl}>`,
        "v:campaignRecipientId": request.campaignRecipientId,
        "v:campaignSendId": request.campaignSendId,
      });
      return {
        ok: true,
        providerMessageId: (result as { id?: string }).id ?? request.idempotencyKey,
        accepted: true,
      };
    } catch (error) {
      const err = error as { status?: number; message?: string };
      const throttled = err.status === 429;
      const retryable = throttled || (typeof err.status === "number" && err.status >= 500);
      return {
        ok: false,
        retryable,
        category: throttled ? "THROTTLED" : retryable ? "TRANSIENT" : "PROVIDER_REJECTED",
        statusCode: err.status,
        error: err.message ?? "Mailgun error",
      };
    }
  }

  async verifyWebhook(_rawBody: string, headers: Record<string, string>): Promise<boolean> {
    const signingKey = getEnv().MAILGUN_WEBHOOK_SIGNING_KEY;
    const timestamp = headers["timestamp"] ?? headers["x-mailgun-timestamp"];
    const token = headers["token"] ?? headers["x-mailgun-token"];
    const signature = headers["signature"] ?? headers["x-mailgun-signature"];
    if (!signingKey || !timestamp || !token || !signature) return false;
    const encoded = createHmac("sha256", signingKey).update(timestamp + token).digest("hex");
    return safeEqual(encoded, signature);
  }
}
