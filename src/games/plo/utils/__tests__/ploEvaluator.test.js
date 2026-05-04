import { describe, expect, it } from "vitest";
import { evaluatePloHand, comparePloHands } from "../ploEvaluator.js";

describe("evaluatePloHand", () => {
  it("uses exactly two hole cards and exactly three board cards", () => {
    const result = evaluatePloHand({
      holeCards: ["AS", "AD", "7C", "8D"],
      boardCards: ["KS", "QS", "JS", "10S", "9S"],
    });

    expect(result.category).not.toBe("STRAIGHT_FLUSH");
    expect(result.holeCardsUsed).toHaveLength(2);
    expect(result.boardCardsUsed).toHaveLength(3);
    expect(result.cardsUsed).toHaveLength(5);
  });

  it("can make a flush only when two suited hole cards are used", () => {
    const result = evaluatePloHand({
      holeCards: ["AS", "2S", "AD", "AC"],
      boardCards: ["KS", "QS", "7S", "3D", "4C"],
    });

    expect(result.category).toBe("FLUSH");
    expect(new Set(result.holeCardsUsed)).toEqual(new Set(["AS", "2S"]));
  });

  it("compares PLO high hands with holdem category ordering", () => {
    const flush = evaluatePloHand({
      holeCards: ["AS", "2S", "AD", "AC"],
      boardCards: ["KS", "QS", "7S", "3D", "4C"],
    });
    const trips = evaluatePloHand({
      holeCards: ["AH", "AD", "7C", "8D"],
      boardCards: ["AS", "KC", "QD", "3H", "2C"],
    });

    expect(comparePloHands(flush, trips)).toBeLessThan(0);
  });
});
