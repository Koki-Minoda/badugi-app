import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../onnxExecutor.js", () => ({
  getOrt: vi.fn(async () => null),
  getOrCreateSession: vi.fn(async () => null),
}));

const { inferBetActionWithOnnx, inferDrawDecisionWithOnnx } = await import("../onnxPolicyAdapter.js");
const { buildAiContext, computeBetDecision } = await import("../policyRouter.js");
const { buildDeterministicSafeDecision } = await import("../onnxPolicyAdapter.js");
const { resolveFallbackDecision } = await import("../tierPolicySmoke.js");

describe("ONNX fallback smoke", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back from missing ONNX session to rule-based policy", async () => {
    const onnxDecision = await inferBetActionWithOnnx({
      variantId: "D03",
      tierId: "pro",
      state: { players: [{ hand: ["AS", "2D", "3C", "4H"], stack: 500 }] },
      legalActions: ["fold", "call", "raise"],
    });
    const context = buildAiContext({
      variantId: "D03",
      tierConfig: {
        id: "pro",
        aggression: 0.65,
        bluffFrequency: 0.18,
        foldThreshold: 0.13,
        raiseThreshold: 0.78,
        raiseSizeMultiplier: 1.25,
        drawAggression: -0.1,
      },
      opponentStats: {},
    });
    const ruleDecision = computeBetDecision({
      context,
      toCall: 20,
      canRaise: true,
      madeCards: 4,
      betSize: 20,
      actor: { stack: 500, betThisRound: 0 },
      evaluation: { ranks: [1, 2, 3, 4] },
    });
    const decision = resolveFallbackDecision({
      onnxDecision,
      ruleDecision,
      deterministicDecision: buildDeterministicSafeDecision(["call"]),
    });

    expect(onnxDecision).toBeNull();
    expect(decision).toMatchObject({ source: "policy-router" });
  });

  it("uses deterministic safe fallback if ONNX and rule policy are unavailable", () => {
    expect(
      resolveFallbackDecision({
        onnxDecision: null,
        ruleDecision: null,
        deterministicDecision: buildDeterministicSafeDecision(["raise", "call"]),
      }),
    ).toEqual({ action: "CALL", source: "deterministic-safe" });
  });

  it("keeps S02 Pro playable when ONNX loading is unavailable", async () => {
    const betDecision = await inferBetActionWithOnnx({
      variantId: "S02",
      tierId: "pro",
      observation: {
        variantId: "S02",
        state: {
          street: "BET",
          players: [{ hand: ["AC", "2D", "3H", "9S", "KD"], stack: 500 }],
        },
        seatIndex: 0,
        legalActions: ["fold", "call", "raise"],
      },
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    const drawDecision = await inferDrawDecisionWithOnnx({
      variantId: "S02",
      tierId: "pro",
      observation: {
        variantId: "S02",
        state: {
          street: "DRAW",
          drawRoundIndex: 1,
          players: [{ hand: ["AC", "2D", "3H", "9S", "KD"], stack: 500 }],
        },
        seatIndex: 0,
        legalActions: ["draw_0", "draw_1", "draw_2", "draw_3", "draw_4", "draw_5"],
      },
      legalActions: ["draw_0", "draw_1", "draw_2", "draw_3", "draw_4", "draw_5"],
    });
    const fallback = resolveFallbackDecision({
      onnxDecision: betDecision,
      ruleDecision: { action: "CALL", source: "policy-router" },
      deterministicDecision: buildDeterministicSafeDecision(["call"]),
    });

    expect(betDecision).toBeNull();
    expect(drawDecision).toBeNull();
    expect(fallback).toEqual({ action: "CALL", source: "policy-router" });
  });
});
