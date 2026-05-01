import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../onnxExecutor.js", () => ({
  getOrt: vi.fn(async () => null),
  getOrCreateSession: vi.fn(async () => null),
}));

const { inferBetActionWithOnnx } = await import("../onnxPolicyAdapter.js");
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
});
