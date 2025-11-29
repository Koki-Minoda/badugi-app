import { describe, it, expect } from "vitest";
import { evaluateNlhHand, compareNlhHands } from "../nlhEvaluator";

function hand(cards) {
  return evaluateNlhHand({ cards });
}

function cardSetEquals(actual, expected) {
  expect(new Set(actual)).toEqual(new Set(expected));
}

describe("evaluateNlhHand categories", () => {
  it("detects high card", () => {
    const result = hand(["7C", "9D", "QS", "3H", "2C"]);
    expect(result.category).toBe("HIGH_CARD");
    cardSetEquals(result.best5, ["QS", "9D", "7C", "3H", "2C"]);
  });

  it("detects pair", () => {
    const result = hand(["9C", "9D", "5S", "3H", "2C"]);
    expect(result.category).toBe("PAIR");
    expect(result.primaryRanks).toEqual([9]);
  });

  it("detects two pair", () => {
    const result = hand(["9C", "9D", "5S", "5C", "2H"]);
    expect(result.category).toBe("TWO_PAIR");
    expect(result.primaryRanks).toEqual([9, 5]);
  });

  it("detects three of a kind", () => {
    const result = hand(["9C", "9D", "9S", "5H", "2C"]);
    expect(result.category).toBe("THREE_OF_A_KIND");
    expect(result.primaryRanks).toEqual([9]);
  });

  it("detects straight including wheel", () => {
    const broadway = hand(["9C", "8D", "7S", "6H", "5C"]);
    expect(broadway.category).toBe("STRAIGHT");
    expect(broadway.primaryRanks).toEqual([9]);

    const wheel = hand(["AC", "2D", "3H", "4S", "5C"]);
    expect(wheel.category).toBe("STRAIGHT");
    expect(wheel.primaryRanks).toEqual([5]);
  });

  it("detects flush", () => {
    const result = hand(["AC", "QC", "9C", "4C", "2C"]);
    expect(result.category).toBe("FLUSH");
    expect(result.primaryRanks[0]).toBe(14);
  });

  it("detects full house", () => {
    const result = hand(["9C", "9D", "9S", "5H", "5C"]);
    expect(result.category).toBe("FULL_HOUSE");
    expect(result.primaryRanks).toEqual([9]);
    expect(result.kickerRanks).toEqual([5]);
  });

  it("detects four of a kind", () => {
    const result = hand(["9C", "9D", "9S", "9H", "2C"]);
    expect(result.category).toBe("FOUR_OF_A_KIND");
    expect(result.primaryRanks).toEqual([9]);
    expect(result.kickerRanks).toEqual([2]);
  });

  it("detects straight flush", () => {
    const result = hand(["9C", "8C", "7C", "6C", "5C"]);
    expect(result.category).toBe("STRAIGHT_FLUSH");
    expect(result.primaryRanks).toEqual([9]);
  });
});

describe("compareNlhHands behavior", () => {
  it("returns 0 for identical hands", () => {
    const a = hand(["AS", "KS", "QS", "JS", "TS"]);
    const b = hand(["TS", "QS", "KS", "AS", "JS"]);
    expect(compareNlhHands(a, b)).toBe(0);
  });

  it("orders flushes by kickers", () => {
    const strong = hand(["AS", "QS", "9S", "4S", "2S"]);
    const weak = hand(["KS", "QS", "9S", "4S", "2S"]);
    expect(compareNlhHands(strong, weak)).toBeLessThan(0);
    expect(compareNlhHands(weak, strong)).toBeGreaterThan(0);
  });

  it("prefers straights over trips", () => {
    const straight = hand(["9C", "8D", "7S", "6H", "5C"]);
    const trips = hand(["AC", "AD", "AH", "5S", "2D"]);
    expect(compareNlhHands(straight, trips)).toBeLessThan(0);
  });
});

describe("best 5 of 7 selection", () => {
  it("uses both hole cards when necessary", () => {
    const result = hand(["AS", "KS", "QD", "JC", "10H", "2S", "3D"]);
    expect(result.category).toBe("STRAIGHT");
    cardSetEquals(result.best5, ["AS", "KS", "QD", "JC", "10H"]);
  });

  it("uses exactly one hole card when optimal", () => {
    const result = hand(["AH", "KD", "QH", "JS", "10C", "9D", "2C"]);
    expect(result.category).toBe("STRAIGHT");
    cardSetEquals(result.best5, ["AH", "KD", "QH", "JS", "10C"]);
  });

  it("accepts board-only best hand", () => {
    const result = hand(["AS", "KS", "QS", "JS", "9S", "2D", "3C"]);
    expect(result.category).toBe("FLUSH");
    cardSetEquals(result.best5, ["AS", "KS", "QS", "JS", "9S"]);
  });

  it("chooses winner correctly among 7-card comparisons", () => {
    const playerA = hand(["AS", "AD", "KH", "QC", "JD", "3S", "2C"]);
    const playerB = hand(["KS", "KD", "QH", "JC", "10D", "3S", "2C"]);
    expect(compareNlhHands(playerA, playerB)).toBeLessThan(0);
  });
});
