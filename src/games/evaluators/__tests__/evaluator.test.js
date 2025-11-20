import { describe, expect, it } from "vitest";
import { evaluateHighHand } from "../../evaluators/high.js";
import { evaluateLowHand } from "../../evaluators/low.js";
import { evaluateBadugiHand } from "../../evaluators/badugi.js";
import { evaluateHand, compareEvaluations } from "../../evaluators/registry.js";

describe("High-hand evaluator", () => {
  it("detects straight flush beating four of a kind", () => {
    const straightFlush = evaluateHighHand({
      cards: ["AS", "KS", "QS", "JS", "10S", "3D", "4C"],
    });
    const fourKind = evaluateHighHand({
      cards: ["9H", "9C", "9D", "9S", "4H", "2D", "3C"],
    });
    expect(compareEvaluations(straightFlush, fourKind) < 0).toBe(true);
  });
});

describe("Lowball evaluator", () => {
  it("rates 7-5-4-3-2 better than 8-high in 2-7", () => {
    const sevenHigh = evaluateLowHand({
      cards: ["7S", "5D", "4C", "3H", "2S", "KD", "QC"],
      lowType: "27",
    });
    const eightHigh = evaluateLowHand({
      cards: ["8S", "5D", "4C", "3H", "2S", "KD", "QC"],
      lowType: "27",
    });
    expect(compareEvaluations(sevenHigh, eightHigh) < 0).toBe(true);
  });

  it("treats wheel as best hand in A-5 low", () => {
    const wheel = evaluateLowHand({
      cards: ["AS", "2D", "3C", "4H", "5S", "KD"],
      lowType: "A5",
    });
    expect(wheel.metadata.ranks[0]).toBe(5);
  });
});

describe("Badugi evaluator", () => {
  it("prefers 4-card Badugi", () => {
    const four = evaluateBadugiHand({ cards: ["AS", "2D", "3C", "4H"] });
    const three = evaluateBadugiHand({ cards: ["AS", "AD", "3C", "4H"] });
    expect(compareEvaluations(four, three) < 0).toBe(true);
  });
});

describe("Registry evaluateHand", () => {
  it("evaluates Badugi via registry tag", () => {
    const result = evaluateHand({ cards: ["AS", "2D", "3C", "4H"], gameType: "badugi" });
    expect(result.metadata.size).toBe(4);
  });
});
