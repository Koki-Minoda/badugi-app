import { describe, expect, it } from "vitest";
import { createCardKey, encryptCard, decryptCard } from "../security";

describe("p2p/security", () => {
  it("encrypts/decrypts card ids", () => {
    const keyId = "test-key";
    createCardKey(keyId);
    const cardId = "AH";
    const token = encryptCard(cardId, keyId);
    expect(token.keyId).toBe(keyId);
    expect(token.iv).toHaveLength(16);
    const decoded = decryptCard(token);
    expect(decoded).toBe(cardId);
  });
});
