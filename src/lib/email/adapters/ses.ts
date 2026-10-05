import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { getEnv } from "../../env";
import type { EmailProviderAdapter, SendRequest, SendResult } from "../types";

export class SesAdapter implements EmailProviderAdapter {
  name = "ses";
  private client: SESClient;

  constructor() {
    this.client = new SESClient({ region: getEnv().SES_REGION });
  }

  async send(request: SendRequest): Promise<SendResult> {
    try {
      const env = getEnv();
      const result = await this.client.send(
        new SendEmailCommand({
          Source: request.from.name
            ? `${request.from.name} <${request.from.email}>`
            : request.from.email,
          Destination: { ToAddresses: [request.to] },
          ReplyToAddresses: request.replyTo ? [request.replyTo] : undefined,
          ConfigurationSetName: env.SES_CONFIGURATION_SET,
          Message: {
            Subject: { Data: request.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: request.html, Charset: "UTF-8" },
              Text: { Data: request.text, Charset: "UTF-8" },
            },
          },
          Tags: [
            { Name: "campaignRecipientId", Value: request.campaignRecipientId },
            { Name: "campaignSendId", Value: request.campaignSendId },
          ],
        }),
      );
      return {
        ok: true,
        providerMessageId: result.MessageId ?? request.idempotencyKey,
        accepted: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode;
      const throttled =
        status === 429 || /throttl|slowdown|rate exceeded/i.test(message);
      const retryable = throttled || (status !== undefined && status >= 500);
      return {
        ok: false,
        retryable,
        category: throttled ? "THROTTLED" : retryable ? "TRANSIENT" : "PROVIDER_REJECTED",
        statusCode: status,
        error: message,
      };
    }
  }
}
