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

  it("folds marginal three-card hands more often in crowded six-max pots", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    const decision = computeBetDecision({
      context,
      toCall: 20,
      canRaise: true,
      madeCards: 3,
      betSize: 20,
      actor: { stack: 200, betThisRound: 0 },
      evaluation: { ranks: [2, 9, 11] },
      activeOpponents: 4,
      drawRound: 0,
      betRound: 0,
    });
    expect(decision.action).toBe("FOLD");
    expect(decision.reason).toMatch(/multiway|crowded/);
    vi.restoreAllMocks();
  });

  it("keeps strong three-card draws playable heads-up", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    const decision = computeBetDecision({
      context,
      toCall: 20,
      canRaise: true,
      madeCards: 3,
      betSize: 20,
      actor: { stack: 200, betThisRound: 0 },
      evaluation: { ranks: [1, 2, 5] },
      activeOpponents: 1,
      drawRound: 0,
      betRound: 0,
    });
    expect(decision.action).toBe("CALL");
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
    expect(decision.drawCount).toBe(2);
    vi.restoreAllMocks();
  });

  it("loose tiers can overdraw weak made hands", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    const looseContext = buildAiContext({
      variantId: "D03",
      tierConfig: { ...tier, id: "beginner", drawAggression: 0.2 },
      opponentStats: {},
    });
    const decision = computeDrawDecision({
      context: looseContext,
      evaluation: { ranks: [1, 2], kicker: 10 },
    });
    expect(decision.drawCount).toBe(3);
    vi.restoreAllMocks();
  });

  it("prefers dead cards when selecting discard indexes", () => {
    const decision = computeDrawDecision({
      context,
      hand: ["A♣", "2♦", "K♣", "9♠"],
      evaluation: {
        ranks: [1, 2, 9],
        deadCards: ["K♣"],
      },
    });
    expect(decision.drawCount).toBe(1);
    expect(decision.discardIndexes).toEqual([2]);
  });
});
