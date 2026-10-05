import { getEnv } from "../../env";
import { logger } from "../../logger";
import type { EmailProviderAdapter, SendRequest, SendResult } from "../types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class FakeEmailProvider implements EmailProviderAdapter {
  name = "fake";
  sent: SendRequest[] = [];

  async send(request: SendRequest): Promise<SendResult> {
    const env = getEnv();
    if (env.FAKE_PROVIDER_LATENCY_MS > 0) {
      await sleep(env.FAKE_PROVIDER_LATENCY_MS);
    }
    const roll = Math.random();
    if (roll < env.FAKE_PROVIDER_THROTTLE_RATE) {
      return {
        ok: false,
        retryable: true,
        category: "THROTTLED",
        statusCode: 429,
        error: "Fake provider throttling",
      };
    }
    if (roll < env.FAKE_PROVIDER_THROTTLE_RATE + env.FAKE_PROVIDER_TRANSIENT_RATE) {
      return {
        ok: false,
        retryable: true,
        category: "TRANSIENT",
        statusCode: 503,
        error: "Fake provider temporary error",
      };
    }
    if (
      roll <
      env.FAKE_PROVIDER_THROTTLE_RATE +
        env.FAKE_PROVIDER_TRANSIENT_RATE +
        env.FAKE_PROVIDER_PERMANENT_RATE
    ) {
      return {
        ok: false,
        retryable: false,
        category: "PERMANENT",
        statusCode: 400,
        error: "Fake provider permanent rejection",
      };
    }
    const providerMessageId = `fake_${request.idempotencyKey}`;
    this.sent.push(request);
    logger.debug(
      {
        campaignRecipientId: request.campaignRecipientId,
        to: request.to,
        providerMessageId,
      },
      "fake provider accepted message",
    );
    return { ok: true, providerMessageId, accepted: true };
  }
}

export const fakeProvider = new FakeEmailProvider();
