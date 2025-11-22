import { describe, expect, it } from "vitest";
import { compareEvaluations } from "../../../../../games/evaluators/registry.js";
import { evaluateBadugiHand } from "../../../../../games/evaluators/badugi.js";
import { getWinnersByBadugi } from "../../../../../games/badugi/utils/badugiEvaluator.js";

describe("Badugi regression guardrails", () => {
  it("prefers larger sets over smaller ones regardless of raw score", () => {
    const fourCard = evaluateBadugiHand({
      cards: ["2S", "4H", "6D", "8C"],
    });
    const threeCard = evaluateBadugiHand({
      cards: ["AS", "2H", "3C"],
    });
    expect(fourCard.metadata.size).toBe(4);
    expect(threeCard.metadata.size).toBe(3);
    expect(compareEvaluations(fourCard, threeCard)).toBeLessThan(0);
    expect(compareEvaluations(threeCard, fourCard)).toBeGreaterThan(0);
  });

  it("orders drop-in kickers lexicographically when sizes tie", () => {
    const first = evaluateBadugiHand({
      cards: ["2S", "3H", "4D", "6C"],
    });
    const second = evaluateBadugiHand({
      cards: ["2S", "3H", "5D", "6C"],
    });
    const result = compareEvaluations(first, second);
    expect(result).toBeLessThan(0);
  });

  it("reports the true best player according to evaluator metadata", () => {
    const players = [
      { seat: 2, name: "CPU 2", hand: ["3C", "2S", "7D", "8H"], seatIndex: 2 },
      { seat: 3, name: "CPU 3", hand: ["5C", "4S", "9H", "10D"], seatIndex: 3 },
    ];
    const winners = getWinnersByBadugi(players);
    expect(winners).toHaveLength(1);
    expect(winners[0].seatIndex).toBe(2);
  });
});
