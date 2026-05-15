import { describe, expect, it, vi } from "vitest";
import { buildAiContext, computeBetDecision, computeDrawDecision } from "../../policyRouter.js";
import { evaluateBadugi } from "../../../games/badugi/utils/badugiEvaluator.js";
import { evaluateLowHand } from "../../../games/evaluators/low.js";
import { chooseProAction } from "../proDecisionOverlay.js";

function buildSnapshot({
  variantId,
  street = "DRAW",
  hand = [],
  drawRoundIndex = 0,
  maxDrawRounds = variantId.startsWith("S") ? 1 : 3,
} = {}) {
  return {
    variantId,
    street,
    phase: street,
    drawRoundIndex,
    maxDrawRounds,
    maxDiscardCount: hand.length,
    actingPlayerIndex: 0,
    players: [
      {
        hand: [...hand],
        stack: 500,
        betThisRound: 0,
        allIn: false,
      },
    ],
  };
}

describe("Pro vs Standard sanity", () => {
  it("prefers pair-aware 2-7 discards over generic standard discards", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const hand = ["2S", "2H", "4C", "5D", "7S"];
    const standardContext = buildAiContext({
      variantId: "D01",
      tierConfig: { id: "standard", drawAggression: 0.05 },
      opponentStats: {},
    });
    const standardAction = computeDrawDecision({
      context: standardContext,
      evaluation: evaluateLowHand({ cards: hand, lowType: "27" }),
      hand,
    });
    const proAction = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({ variantId: "D01", hand }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
      standardAction: {
        type: "DRAW",
        discardIndexes: standardAction.discardIndexes,
        reason: standardAction.source,
      },
    });
    expect(standardAction.discardIndexes).not.toEqual(proAction.discardIndexes);
    expect(proAction.discardIndexes).toContain(1);
    vi.restoreAllMocks();
  });

  it("pats clean 7-low in Pro overlay", () => {
    const hand = ["2S", "3H", "4C", "5D", "7S"];
    const proAction = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({ variantId: "D01", hand }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(proAction.discardIndexes).toEqual([]);
  });

  it("pats wheel-equivalent A-5 lows in Pro overlay", () => {
    const hand = ["AS", "2D", "3C", "4H", "5S"];
    const proAction = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({ variantId: "D02", hand }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(proAction.discardIndexes).toEqual([]);
  });

  it("avoids reckless final-round Badugi raises that standard may take", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const hand = ["AS", "AD", "KC", "KS"];
    const standardContext = buildAiContext({
      variantId: "D03",
      tierConfig: {
        id: "standard",
        aggression: 0.45,
        bluffFrequency: 0.08,
        raiseThreshold: 0.9,
        foldThreshold: 0.2,
      },
      opponentStats: {},
    });
    const evaluation = evaluateBadugi(hand);
    const standardAction = computeBetDecision({
      context: standardContext,
      toCall: 0,
      canRaise: true,
      madeCards: evaluation.count,
      evaluation,
      actor: { stack: 500, betThisRound: 0 },
      drawRound: 3,
      betRound: 3,
      activeOpponents: 1,
      betSize: 20,
    });
    const proAction = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        variantId: "D03",
        street: "BET",
        hand,
        drawRoundIndex: 3,
      }),
      legalActions: ["CHECK", "RAISE"],
      standardAction: {
        type: standardAction.action,
        reason: standardAction.reason,
      },
    });
    expect(standardAction.action).toBe("RAISE");
    expect(proAction.type).toBe("CHECK");
    vi.restoreAllMocks();
  });

  it("never returns illegal actions in Pro output", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        variantId: "D03",
        street: "BET",
        hand: ["AS", "2D", "3C", "4H"],
      }),
      legalActions: ["CHECK", "CALL"],
      candidateAction: { type: "RAISE", source: "onnx" },
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    expect(["CHECK", "CALL"]).toContain(result.type);
  });

  it("records fallback state for unsupported families", () => {
    const result = chooseProAction({
      variantId: "B05",
      family: "omaha",
      snapshot: buildSnapshot({
        variantId: "B05",
        street: "BET",
        hand: [],
      }),
      legalActions: ["CHECK", "FOLD"],
    });
    expect(result.source).toBe("safe-fallback");
    expect(result.reason).toBe("unsupported-pro-rules:omaha");
    expect(result.warnings).toContain("unsupported-family:omaha");
  });
});
