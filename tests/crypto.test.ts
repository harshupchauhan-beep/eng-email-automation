import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail, sha256 } from "../src/lib/crypto";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "../src/lib/email/unsubscribe";

describe("email normalization and validation", () => {
  it("normalizes before duplicate checks", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("rejects invalid addresses", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("ada@example.com")).toBe(true);
  });
});

describe("unsubscribe tokens", () => {
  it("does not embed sequential database ids in plaintext", () => {
    const token = createUnsubscribeToken("11111111-2222-4333-8444-555555555555");
    expect(token.includes("11111111")).toBe(false);
    expect(verifyUnsubscribeToken(token)?.recipientId).toBe(
      "11111111-2222-4333-8444-555555555555",
    );
  });

  it("rejects tampered tokens", () => {
    const token = createUnsubscribeToken("rid");
    expect(verifyUnsubscribeToken(token.slice(0, -2) + "aa")).toBeNull();
  });
});

describe("idempotency keys", () => {
  it("derives a stable send identity from campaign send + email", () => {
    const key = `${"send-1"}:${normalizeEmail("Ada@Example.com")}`;
    expect(key).toBe("send-1:ada@example.com");
    expect(sha256(key)).toHaveLength(64);
  });
});
