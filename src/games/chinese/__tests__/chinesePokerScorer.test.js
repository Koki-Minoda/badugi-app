import { describe, expect, it } from "vitest";
import { evaluateChineseRows, evaluateFrontHand } from "../chinesePokerScorer.js";

describe("Chinese Poker / OFC scorer preparation", () => {
  it("scores valid front/middle/back rows without fouling", () => {
    const result = evaluateChineseRows({
      front: ["AS", "AD", "3C"],
      middle: ["KS", "KD", "7H", "7D", "2C"],
      back: ["QS", "QH", "QD", "9C", "9D"],
    });

    expect(result.foul).toBe(false);
    expect(result.front.handName).toBe("Pair A");
    expect(result.middle.handName).toBe("Two Pair");
    expect(result.back.handName).toBe("Full House");
    expect(result.royalties.total).toBeGreaterThan(0);
  });

  it("detects a foul when middle beats back", () => {
    const result = evaluateChineseRows({
      front: ["AS", "KD", "3C"],
      middle: ["QS", "QH", "QD", "9C", "9D"],
      back: ["KS", "KD", "7H", "7D", "2C"],
    });

    expect(result.foul).toBe(true);
    expect(result.foulReasons).toContain("middle-beats-back");
  });

  it("detects a foul when front is stronger than middle", () => {
    const result = evaluateChineseRows({
      front: ["AS", "AD", "AC"],
      middle: ["KS", "QD", "8H", "7D", "2C"],
      back: ["QS", "QH", "QD", "9C", "9D"],
    });

    expect(result.foul).toBe(true);
    expect(result.foulReasons).toContain("front-beats-middle");
  });

  it("rejects invalid row sizes", () => {
    const result = evaluateChineseRows({
      front: ["AS", "AD"],
      middle: ["KS", "QD", "8H", "7D", "2C"],
      back: ["QS", "QH", "QD", "9C", "9D"],
    });

    expect(result.foul).toBe(true);
    expect(result.foulReasons).toContain("invalid-row-size");
    expect(evaluateFrontHand(["AS", "AD"]).isValid).toBe(false);
  });
});
