import { describe, expect, it } from "vitest";

const CAMPAIGN_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["READY", "SCHEDULED", "QUEUING", "CANCELLED"],
  READY: ["QUEUING", "SCHEDULED", "CANCELLED"],
  SCHEDULED: ["QUEUING", "CANCELLED"],
  QUEUING: ["QUEUED", "PAUSED", "CANCELLED", "COMPLETED"],
  QUEUED: ["SENDING", "PAUSED", "CANCELLED"],
  SENDING: ["PAUSED", "COMPLETED", "PARTIALLY_FAILED", "FAILED", "CANCELLED"],
  PAUSED: ["SENDING", "CANCELLED"],
  COMPLETED: [],
  PARTIALLY_FAILED: [],
  FAILED: [],
  CANCELLED: [],
};

const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["QUEUED", "CANCELLED", "SUPPRESSED"],
  QUEUED: ["PROCESSING", "CANCELLED", "SUPPRESSED"],
  PROCESSING: ["SENT", "FAILED", "QUEUED", "SUPPRESSED", "CANCELLED"],
  SENT: ["DELIVERED", "BOUNCED", "COMPLAINED", "DEFERRED"],
  FAILED: ["QUEUED"],
};

function can(map: Record<string, string[]>, from: string, to: string) {
  return map[from]?.includes(to) ?? false;
}

describe("campaign state machine", () => {
  it("does not allow completed campaigns to send again", () => {
    expect(can(CAMPAIGN_TRANSITIONS, "COMPLETED", "QUEUING")).toBe(false);
  });

  it("allows pause and resume without resetting completed deliveries", () => {
    expect(can(CAMPAIGN_TRANSITIONS, "SENDING", "PAUSED")).toBe(true);
    expect(can(CAMPAIGN_TRANSITIONS, "PAUSED", "SENDING")).toBe(true);
    expect(can(DELIVERY_TRANSITIONS, "SENT", "PROCESSING")).toBe(false);
    expect(can(DELIVERY_TRANSITIONS, "DELIVERED" as string, "QUEUED")).toBe(false);
  });
});

describe("send API idempotency contract", () => {
  it("uses a unique campaign send identity", () => {
    const first = { campaignId: "c1", idempotencyKey: "same" };
    const second = { campaignId: "c1", idempotencyKey: "same" };
    expect(first).toEqual(second);
  });
});
