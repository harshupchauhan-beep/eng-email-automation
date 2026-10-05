import { describe, expect, it } from "vitest";
import { normalizeEmail } from "../src/lib/crypto";

describe("suppression rules", () => {
  it("treats addresses as the same after normalization", () => {
    const imported = normalizeEmail("User@Example.COM");
    const suppressed = normalizeEmail("user@example.com");
    expect(imported).toBe(suppressed);
  });

  it("never treats a suppressed address as eligible", () => {
    const suppressed = new Set([normalizeEmail("old@example.com")]);
    const incoming = ["old@example.com", "new@example.com"].map(normalizeEmail);
    const imported = incoming.filter((email) => !suppressed.has(email));
    expect(imported).toEqual(["new@example.com"]);
  });
});
