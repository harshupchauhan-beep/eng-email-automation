import { describe, expect, it } from "vitest";
import { FakeEmailProvider } from "../src/lib/email/adapters/fake";
import { resetEnvCache } from "../src/lib/env";

describe("fake provider throttling", () => {
  it("classifies throttle responses as retryable", async () => {
    process.env.FAKE_PROVIDER_THROTTLE_RATE = "1";
    process.env.FAKE_PROVIDER_TRANSIENT_RATE = "0";
    process.env.FAKE_PROVIDER_PERMANENT_RATE = "0";
    process.env.FAKE_PROVIDER_LATENCY_MS = "0";
    resetEnvCache();
    const provider = new FakeEmailProvider();
    const result = await provider.send({
      to: "a@example.com",
      from: { email: "from@example.com" },
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
      idempotencyKey: "k1",
      campaignRecipientId: "r1",
      campaignSendId: "s1",
      unsubscribeUrl: "http://localhost/unsubscribe/x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(true);
      expect(result.category).toBe("THROTTLED");
    }
  });
});
