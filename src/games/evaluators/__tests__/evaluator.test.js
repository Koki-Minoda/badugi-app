import { describe, expect, it } from "vitest";
import { evaluateHighHand } from "../../evaluators/high.js";
import { evaluateLowHand, formatLowHandLabel } from "../../evaluators/low.js";
import { evaluateBadugiHand } from "../../evaluators/badugi.js";
import { evaluateHand, compareEvaluations } from "../../evaluators/registry.js";
import {
  evaluateBadacey,
  evaluateBadeucey,
  evaluateHiLoEight,
} from "../../evaluators/split.js";

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

  it("penalizes pairs in 2-7 lowball", () => {
    const cleanQueen = evaluateLowHand({
      cards: ["QS", "9D", "7C", "4H", "2S"],
      lowType: "27",
    });
    const pairedSeven = evaluateLowHand({
      cards: ["7S", "7D", "5C", "4H", "2S"],
      lowType: "27",
    });
    expect(compareEvaluations(cleanQueen, pairedSeven) < 0).toBe(true);
    expect(pairedSeven.metadata.penalty).toBeGreaterThan(0);
  });

  it("penalizes straights and flushes in 2-7 lowball", () => {
    const roughTen = evaluateLowHand({
      cards: ["10S", "8D", "6C", "4H", "2S"],
      lowType: "27",
    });
    const straightSeven = evaluateLowHand({
      cards: ["7S", "6D", "5C", "4H", "3S"],
      lowType: "27",
    });
    const flushSeven = evaluateLowHand({
      cards: ["7S", "5S", "4S", "3S", "2S"],
      lowType: "27",
    });

    expect(compareEvaluations(roughTen, straightSeven) < 0).toBe(true);
    expect(compareEvaluations(roughTen, flushSeven) < 0).toBe(true);
    expect(straightSeven.metadata.penalty).toBeGreaterThan(0);
    expect(flushSeven.metadata.penalty).toBeGreaterThan(0);
  });

  it("does not treat wheel as best in 2-7 lowball", () => {
    const sevenHigh = evaluateLowHand({
      cards: ["7S", "5D", "4C", "3H", "2S"],
      lowType: "27",
    });
    const wheel = evaluateLowHand({
      cards: ["AS", "5D", "4C", "3H", "2S"],
      lowType: "27",
    });
    expect(compareEvaluations(sevenHigh, wheel) < 0).toBe(true);
  });

  it("keeps ties equal for identical 2-7 ranks", () => {
    const first = evaluateLowHand({
      cards: ["7S", "5D", "4C", "3H", "2S"],
      lowType: "27",
    });
    const second = evaluateLowHand({
      cards: ["7C", "5H", "4D", "3S", "2C"],
      lowType: "27",
    });
    expect(compareEvaluations(first, second)).toBe(0);
  });

  it("ignores straights and flushes in A-5 lowball", () => {
    const wheelFlush = evaluateLowHand({
      cards: ["AS", "2S", "3S", "4S", "5S"],
      lowType: "A5",
    });
    const sixLow = evaluateLowHand({
      cards: ["6S", "4D", "3C", "2H", "AS"],
      lowType: "A5",
    });

    expect(compareEvaluations(wheelFlush, sixLow) < 0).toBe(true);
    expect(wheelFlush.metadata.penalty).toBe(0);
  });

  it("penalizes pairs in A-5 lowball", () => {
    const kingLow = evaluateLowHand({
      cards: ["KS", "9D", "7C", "4H", "2S"],
      lowType: "A5",
    });
    const pairedAces = evaluateLowHand({
      cards: ["AS", "AD", "5C", "4H", "2S"],
      lowType: "A5",
    });
    expect(compareEvaluations(kingLow, pairedAces) < 0).toBe(true);
    expect(pairedAces.metadata.penalty).toBeGreaterThan(0);
  });

  it("chooses the best five-card low from six or more cards", () => {
    const result = evaluateLowHand({
      cards: ["KS", "7D", "5C", "4H", "3S", "2D"],
      lowType: "27",
    });

    expect(result.metadata.ranks).toEqual([7, 5, 4, 3, 2]);
    expect(result.metadata.cards).not.toContain("KS");
  });

  it("adds qualifier debug metadata for A-5 eight-or-better lows", () => {
    const qualifying = evaluateLowHand({
      cards: ["8S", "4D", "3C", "2H", "AS"],
      lowType: "A5",
      requireQualifier: 8,
    });
    const nonQualifying = evaluateLowHand({
      cards: ["9S", "4D", "3C", "2H", "AS"],
      lowType: "A5",
      requireQualifier: 8,
    });

    expect(qualifying.qualifies).toBe(true);
    expect(qualifying.metadata.qualifies).toBe(true);
    expect(qualifying.metadata.qualifier).toBe(8);
    expect(nonQualifying.qualifies).toBe(false);
    expect(nonQualifying.metadata.qualifies).toBe(false);
    expect(nonQualifying.rankSecondary).toBe(Number.POSITIVE_INFINITY);
  });

  it("formats 2-7 showdown labels for D01", () => {
    const result = evaluateLowHand({
      cards: ["7S", "5D", "4C", "3H", "2S"],
      lowType: "27",
    });

    expect(formatLowHandLabel(result, { lowType: "27" })).toBe("2-7 Low 7-5-4-3-2");
  });
});

describe("D01 2-7 Triple Draw evaluator regression", () => {
  function d01(cards) {
    return evaluateLowHand({ cards, lowType: "27" });
  }

  it.each([
    {
      label: "keeps 7-5-4-3-2 as the best made low",
      best: ["7S", "5D", "4C", "3H", "2S"],
      worse: ["8S", "5D", "4C", "3H", "2S"],
      ranks: [7, 5, 4, 3, 2],
      penalty: 0,
    },
    {
      label: "penalizes the A-5 wheel because straights are bad in 2-7",
      best: ["7S", "5D", "4C", "3H", "2S"],
      worse: ["AS", "5D", "4C", "3H", "2S"],
      ranks: [7, 5, 4, 3, 2],
      penalty: 0,
    },
    {
      label: "treats a clean ten-low as better than a paired seven-low",
      best: ["10S", "8D", "6C", "4H", "2S"],
      worse: ["7S", "7D", "5C", "4H", "2S"],
      ranks: [10, 8, 6, 4, 2],
      penalty: 0,
    },
    {
      label: "treats a clean ten-low as better than a seven-high flush",
      best: ["10S", "8D", "6C", "4H", "2S"],
      worse: ["7S", "5S", "4S", "3S", "2S"],
      ranks: [10, 8, 6, 4, 2],
      penalty: 0,
    },
  ])("$label", ({ best, worse, ranks, penalty }) => {
    const bestEval = d01(best);
    const worseEval = d01(worse);

    expect(compareEvaluations(bestEval, worseEval)).toBeLessThan(0);
    expect(bestEval.metadata.ranks).toEqual(ranks);
    expect(bestEval.metadata.penalty).toBe(penalty);
  });

  it("selects the best D01 five-card low and ignores a sixth high card", () => {
    const result = d01(["KS", "7D", "5C", "4H", "3S", "2D"]);

    expect(result.metadata.ranks).toEqual([7, 5, 4, 3, 2]);
    expect(result.metadata.cards).toEqual(["7D", "5C", "4H", "3S", "2D"]);
    expect(formatLowHandLabel(result, { lowType: "27" })).toBe("2-7 Low 7-5-4-3-2");
  });

  it("keeps equal D01 rank arrays tied across suits", () => {
    const first = d01(["8S", "6D", "5C", "3H", "2S"]);
    const second = d01(["8C", "6H", "5D", "3S", "2C"]);

    expect(compareEvaluations(first, second)).toBe(0);
    expect(first.metadata.penalty).toBe(0);
    expect(second.metadata.penalty).toBe(0);
  });

  it("orders every common 2-7 made class behind a clean 7-low", () => {
    const sevenLow = d01(["7S", "5D", "4C", "3H", "2S"]);
    const weakerHands = [
      ["8S", "5D", "4C", "3H", "2S"],
      ["4S", "4D", "7C", "3H", "2S"],
      ["6S", "5D", "4C", "3H", "2S"],
      ["7S", "5S", "4S", "3S", "2S"],
      ["AS", "5D", "4C", "3H", "2S"],
    ];

    for (const cards of weakerHands) {
      expect(compareEvaluations(sevenLow, d01(cards))).toBeLessThan(0);
    }
  });
});

describe("A-5 lowball evaluator regression", () => {
  function a5(cards) {
    return evaluateLowHand({ cards, lowType: "A5" });
  }

  it("orders wheel, six-low, king-low, then paired lows", () => {
    const wheel = a5(["AS", "2S", "3S", "4S", "5S"]);
    const sixLow = a5(["6D", "4C", "3H", "2D", "AC"]);
    const kingLow = a5(["KS", "9D", "7C", "4H", "2S"]);
    const pairedAces = a5(["AS", "AD", "5C", "4H", "2S"]);

    expect(compareEvaluations(wheel, sixLow)).toBeLessThan(0);
    expect(compareEvaluations(sixLow, kingLow)).toBeLessThan(0);
    expect(compareEvaluations(kingLow, pairedAces)).toBeLessThan(0);
    expect(wheel.metadata.penalty).toBe(0);
    expect(pairedAces.metadata.penalty).toBeGreaterThan(0);
  });
});

describe("Split evaluator", () => {
  it("returns Badugi and 2-7 low metadata for Badeucey", () => {
    const result = evaluateBadeucey({
      cards: ["7S", "5D", "4C", "3H", "2S"],
    });

    expect(result.metadata.high.handName).toMatch(/Badugi/i);
    expect(result.metadata.low.handName).toBe("2-7 Low");
    expect(result.rankSecondary).toBe(result.metadata.low.rankPrimary);
  });

  it("returns Badugi and A-5 low metadata for Badacey", () => {
    const result = evaluateBadacey({
      cards: ["AS", "2D", "3C", "4H", "5S"],
    });

    expect(result.metadata.high.handName).toMatch(/Badugi/i);
    expect(result.metadata.low.handName).toBe("A-5 Low");
  });

  it("marks hi-lo eight low qualification in split metadata", () => {
    const qualifying = evaluateHiLoEight({
      cards: ["AS", "2D", "3C", "4H", "8S", "KH", "KD"],
    });
    const nonQualifying = evaluateHiLoEight({
      cards: ["AS", "2D", "3C", "4H", "9S", "KH", "KD"],
    });

    expect(qualifying.metadata.low.metadata.qualifies).toBe(true);
    expect(qualifying.rankSecondary).not.toBe(Number.POSITIVE_INFINITY);
    expect(nonQualifying.metadata.low.metadata.qualifies).toBe(false);
    expect(nonQualifying.rankSecondary).toBe(Number.POSITIVE_INFINITY);
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
