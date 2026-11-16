import { describe, expect, it } from "vitest";
import {
  CLOSE_EV, evaluateFinalDraw, finalDrawQuestions, findFinalDrawReview, summarizeFinalDrawAttempts,
} from "../badugiFinalDraw.js";

describe("third-draw decision model", () => {
  it("changes the preferred action when only the opponent's draw changes", () => {
    const [one, pat] = finalDrawQuestions("practice");
    expect(one.cards).toEqual(pat.cards);
    expect(one.range).toBe(pat.range);
    expect(one.pot).toBe(pat.pot);
    expect(evaluateFinalDraw(one).actions[0].id).toBe("pat");
    expect(evaluateFinalDraw(pat).actions[0].id).toBe("10C");
  });

  it("finds a close choice and reports a loss from the best modeled action", () => {
    const result = evaluateFinalDraw(finalDrawQuestions("practice").at(-1));
    expect(result.actions).toHaveLength(5);
    expect(result.actions[0].loss).toBe(0);
    expect(result.actions[1].loss).toBeGreaterThan(0);
    expect(result.actions[1].loss).toBeLessThan(CLOSE_EV);
    expect(result.actions.at(-1).loss).toBeCloseTo(result.actions[0].ev - result.actions.at(-1).ev);
    expect(summarizeFinalDrawAttempts([
      { loss: 0.004, confidence: "high" }, { loss: 0.1, confidence: "high" },
    ])).toMatchObject({ closeChoices: 1, highConfidenceMisses: 1, count: 2 });
  });

  it("keeps holdout hands separate and rejects invalid card assumptions", () => {
    const practiced = finalDrawQuestions("practice").map((q) => q.cards.join(","));
    expect(finalDrawQuestions("retest").every((q) => !practiced.includes(q.cards.join(",")))).toBe(true);
    const spot = finalDrawQuestions("practice")[0];
    expect(() => evaluateFinalDraw({ ...spot, knownDead: [spot.cards[0]] })).toThrow();
    expect(() => evaluateFinalDraw({ ...spot, opponentDraw: 2 })).toThrow();
  });

  it("uses different hands under matching conditions for replay follow-up and retest", () => {
    const first = finalDrawQuestions("transfer");
    const second = finalDrawQuestions("transferRetest");
    const hands = ["practice", "retest", "transfer", "transferRetest"].flatMap(mode =>
      finalDrawQuestions(mode).map(question => [...question.cards].sort().join(",")));
    // The ordinary practice deliberately repeats the same hand with new information.
    expect(second).toHaveLength(first.length);
    expect(second.map(({ pot, range, opponentDraw }) => [pot, range, opponentDraw]))
      .toEqual(first.map(({ pot, range, opponentDraw }) => [pot, range, opponentDraw]));
    expect(hands.slice(-10).every(hand => hands.indexOf(hand) === hands.lastIndexOf(hand))).toBe(true);
    const measure = questions => questions.map(question => {
      const { actions } = evaluateFinalDraw(question);
      return { pat: actions[0].id === "pat", gap: actions[1].loss };
    });
    const firstScores = measure(first);
    const secondScores = measure(second);
    expect(firstScores.filter(score => !score.pat)).toHaveLength(2);
    secondScores.forEach((score, index) => {
      expect(score.pat).toBe(firstScores[index].pat);
      expect(Math.abs(score.gap - firstScores[index].gap)).toBeLessThan(0.15);
    });
  });

  it("uses only the actor's pre-draw cards and public information in a saved review", () => {
    const hand = {
      handId: "eligible", variantId: "badugi", endedAt: 5, userId: 7, level: { bb: 20 },
      seats: [{ seat: 0, isHero: true }, { seat: 1 }],
      events: [
        { type: "DRAW_ACTION", drawRoundIndex: 3, seat: 1, drawCount: 1, potAfter: 120,
          before: ["2D"], after: ["3D"], playersAfter: [{ seat: 0, stack: 80 }, { seat: 1, stack: 80 }] },
        { type: "DRAW_ACTION", drawRoundIndex: 3, seat: 0, drawCount: 1, actionSeq: 15,
          before: ["AS", "3H", "5D", "TC"], after: ["AS", "3H", "5D", "2C"], discarded: [3] },
      ],
    };
    expect(findFinalDrawReview([hand], 7)).toEqual({
      handId: "eligible", endedAt: 5, actionSeq: 15, cards: ["AS", "3H", "5D", "10C"],
      pot: 3, opponentDraw: 1, range: "balanced", actualAction: "10C",
    });
    expect(findFinalDrawReview([hand], 8)).toBeNull();
  });
});
