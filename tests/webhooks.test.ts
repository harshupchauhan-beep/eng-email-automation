import { describe, expect, it } from "vitest";
import { parseWebhookEvents, verifyWebhookSignature } from "../src/lib/email/webhooks";

describe("webhook processing", () => {
  it("accepts authentic fake-provider webhooks", async () => {
    const ok = await verifyWebhookSignature(
      "fake",
      "{}",
      { "x-webhook-secret": "test-webhook-secret" },
    );
    expect(ok).toBe(true);
  });

  it("rejects unauthenticated webhooks", async () => {
    const ok = await verifyWebhookSignature("fake", "{}", { "x-webhook-secret": "nope" });
    expect(ok).toBe(false);
  });

  it("normalizes sendgrid events with stable ids", () => {
    const events = parseWebhookEvents("sendgrid", [
      { event: "bounce", email: "a@example.com", sg_event_id: "evt-1", sg_message_id: "msg-1" },
      { event: "spamreport", email: "a@example.com", sg_event_id: "evt-2" },
    ]);
    expect(events[0].type).toBe("bounced");
    expect(events[1].type).toBe("complained");
    expect(events[0].providerEventId).toBe("evt-1");
  });
});
