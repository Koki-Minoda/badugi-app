import { describe, expect, it, vi } from "vitest";
import { computeBetDecision, computeDrawDecision, buildAiContext } from "../policyRouter.js";

describe("policyRouter", () => {
  const tier = {
    id: "pro",
    aggression: 0.6,
    bluffFrequency: 0.2,
    raiseSizeMultiplier: 1.4,
    foldThreshold: 0.18,
    raiseThreshold: 0.8,
    drawAggression: -0.1,
  };
  const context = buildAiContext({
    variantId: "D03",
    tierConfig: tier,
    opponentStats: {},
  });

  it("returns fold when toCall high and made cards low", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const decision = computeBetDecision({
      context,
      toCall: 40,
      canRaise: true,
      madeCards: 1,
      betSize: 20,
      actor: { stack: 200, betThisRound: 0 },
    });
    expect(decision.action).toBe("FOLD");
    vi.restoreAllMocks();
  });

  it("boosts raise size with tier multiplier", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const decision = computeBetDecision({
      context,
      toCall: 0,
      canRaise: true,
      madeCards: 3,
      betSize: 20,
      actor: { stack: 200, betThisRound: 0 },
    });
    expect(decision.action).toBe("RAISE");
    expect(decision.raiseSize).toBeGreaterThanOrEqual(28);
    vi.restoreAllMocks();
  });

  it("adjusts draw count with tier aggression", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    const decision = computeDrawDecision({
      context,
      evaluation: { ranks: [1, 2], kicker: 10 },
    });
    expect(decision.drawCount).toBeGreaterThan(2);
    vi.restoreAllMocks();
  });
});
