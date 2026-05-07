import { describe, expect, it } from "vitest";
import { chooseProAction } from "../proDecisionOverlay.js";

function buildSnapshot({
  street = "DRAW",
  variantId = "D03",
  hand = [],
  allIn = false,
  actingPlayerIndex = 0,
  drawRoundIndex = 1,
  maxDiscardCount = hand.length,
  currentBet = 0,
  betThisRound = 0,
  maxDrawRounds = variantId.startsWith("S") ? 1 : 3,
} = {}) {
  return {
    variantId,
    street,
    phase: street,
    actingPlayerIndex,
    drawRoundIndex,
    maxDiscardCount,
    maxDrawRounds,
    currentBet,
    players: [
      {
        hand: [...hand],
        allIn,
        stack: allIn ? 0 : 500,
        betThisRound,
      },
    ],
  };
}

describe("chooseProAction", () => {
  it("PRO-001 never returns an action outside legalActions", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        hand: ["AS", "2D", "3C", "4H"],
      }),
      legalActions: ["DRAW"],
      candidateAction: { type: "RAISE", source: "onnx" },
    });
    expect(result.type).toBe("DRAW");
  });

  it("PRO-002 prefers pat on made Badugi draw hands", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        hand: ["AS", "2D", "3C", "4H"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 4 }],
    });
    expect(result).toMatchObject({
      type: "DRAW",
      source: "pro-overlay",
      reason: "made-badugi-pat",
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-003 returns legal discard indexes for weak Badugi duplicates", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        hand: ["AS", "AD", "KC", "KS"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 4 }],
    });
    expect(result.type).toBe("DRAW");
    expect(result.discardIndexes.every((index) => index >= 0 && index < 4)).toBe(true);
  });

  it("PRO-BADUGI-002 draws one with a strong 3-card Badugi", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        hand: ["AS", "2D", "3S", "KH"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 4 }],
    });
    expect(result.type).toBe("DRAW");
    expect(result.discardIndexes.length).toBe(1);
  });

  it("PRO-BADUGI-004 does not over-raise weak final betting hands", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "AD", "KC", "KS"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("CHECK");
    expect(result.reason).toBe("final-round-no-spew-check");
  });

  it("PRO-BADUGI-005 may value-bet strong made hands when legal", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "3C", "4H"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
    expect(result.reason).toMatch(/value|pressure/);
  });

  it("PRO-BADUGI-006 all-in seats receive no betting action beyond check", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        street: "BET",
        hand: ["AS", "2D", "3C", "4H"],
        allIn: true,
      }),
      legalActions: ["CHECK", "RAISE", "CALL"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-D03-BET-001 made Badugi value-bets when legal", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        variantId: "D03",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "3C", "5H"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(["BET", "RAISE"]).toContain(result.type);
  });

  it("PRO-D03-BET-003 facing expensive calls with weak Badugi draws may fold", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        variantId: "D03",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "AD", "KC", "QS"],
        currentBet: 120,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-004 respects D01 discard cap", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        hand: ["2S", "2H", "9C", "KD", "QS"],
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.type).toBe("DRAW");
    expect(result.discardIndexes.length).toBeLessThanOrEqual(5);
  });

  it("PRO-D01-001 pats clean 7-low hands", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        hand: ["2S", "3H", "4C", "5D", "7S"],
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-D01-002 discards a pair instead of patting a duplicated hand", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        hand: ["2S", "2H", "4C", "5D", "7S"],
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toContain(1);
  });

  it("PRO-D01-003 discards a high card from rough 2-7 holdings", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        hand: ["2S", "4H", "8C", "QD", "KS"],
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes.length).toBeGreaterThan(0);
    expect(result.discardIndexes.some((index) => index === 3 || index === 4)).toBe(true);
  });

  it("PRO-D01-004 breaks straight or flush penalties", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        hand: ["3S", "4H", "5C", "6D", "7S"],
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes.length).toBe(1);
  });

  it("PRO-D01-005 respects fixed-limit raise cap by not inventing raises", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3H", "4C", "5D", "7S"],
      }),
      legalActions: ["CHECK", "CALL"],
    });
    expect(["CHECK", "CALL"]).toContain(result.type);
  });

  it("PRO-D01-BET-001 weak 9-low does not raise on the final betting round", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "4H", "6C", "7D", "9S"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-D01-BET-002 strong 7-low value-bets when legal", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3H", "4C", "5D", "7S"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-D01-BET-003 paired penalty hands avoid expensive calls", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "2H", "5C", "7D", "9S"],
        currentBet: 120,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D01-EV-001 smooth 8-low value bets", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3H", "4C", "6D", "8S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-D01-EV-002 rough 8-low does not over-raise", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "5H", "6C", "7D", "8S"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-D01-EV-003 9-low folds facing expensive raises", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "4H", "6C", "7D", "9S"],
        currentBet: 120,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D01-EV-004 penalty hands avoid final calls", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["3S", "4H", "5C", "6D", "7S"],
        currentBet: 60,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-005 treats A-5 wheel as pat", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        hand: ["AS", "2D", "3C", "4H", "5S"],
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result).toMatchObject({
      type: "DRAW",
      reason: "wheel-or-strong-a5-pat",
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-D02-002 treats ace as the low card in A-5", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        hand: ["AS", "2D", "3C", "4H", "6S"],
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-D02-003 discards paired A-5 hands", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        hand: ["AS", "AH", "3C", "4H", "5S"],
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes.length).toBe(1);
  });

  it("PRO-D02-004 does not over-penalize strong straight-like A-5 lows", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        hand: ["2S", "3H", "4C", "5D", "6S"],
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-D02-005 may value-bet strong A-5 lows", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AS", "2D", "3C", "4H", "6S"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-D02-BET-002 weak A-5 9-low avoids final-round raises", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "4C", "7H", "9S"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-D02-BET-003 straight-like A-5 hands are still treated as playable strength", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3H", "4C", "5D", "6S"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-D02-EV-001 wheel raises when legal", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "3C", "4H", "5S"],
        currentBet: 20,
        betThisRound: 0,
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-D02-EV-002 smooth 7-low value bets", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "3C", "5H", "7S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-D02-EV-003 rough 8-low checks or calls instead of raising", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "3D", "5C", "7H", "8S"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-D02-EV-004 paired final avoids calls", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "AH", "3C", "4H", "7S"],
        currentBet: 60,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-EV-005 ignores straight and flush structure for A-5 value decisions", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3S", "4S", "5S", "6S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-006 does not ask S01/S02 for a second draw", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        hand: ["2S", "2H", "9C", "KD", "QS"],
        drawRoundIndex: 1,
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.type).toBe("DRAW");
    expect(result.discardIndexes.length).toBeLessThanOrEqual(5);
  });

  it("PRO-S01-001 respects single-draw only semantics", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        hand: ["2S", "2H", "4C", "5D", "7S"],
        drawRoundIndex: 1,
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes.length).toBeLessThanOrEqual(1);
  });

  it("PRO-S01-002 inherits 2-7 pair-discard logic", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        hand: ["2S", "2H", "4C", "5D", "7S"],
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toContain(1);
  });

  it("PRO-S02-001 respects single-draw only semantics", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["AS", "AH", "3C", "4H", "5S"],
        drawRoundIndex: 1,
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes.length).toBeLessThanOrEqual(1);
  });

  it("PRO-S02-002 inherits A-5 logic", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["AS", "2D", "3C", "4H", "6S"],
        maxDiscardCount: 5,
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-SD-001 final betting does not reckless raise weak single-draw hands", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "2H", "9C", "KD", "QS"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-SD-BET-001 single-draw weak final hands check or fold", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "7C", "9D", "QS"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-SD-BET-002 single-draw strong made lows still value-bet", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-SD-BET-003 keeps triple-draw style aggression out of S01 marginal finals", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3H", "5C", "8D", "9S"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-SD-EV-001 strong single-draw lows value bet", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3H", "4C", "6D", "8S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-SD-EV-002 marginal single-draw lows call and do not raise", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "5C", "7H", "8S"],
        currentBet: 20,
        betThisRound: 0,
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-SD-EV-003 weak single-draw lows fold facing bets", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "5H", "7C", "9D", "QS"],
        currentBet: 80,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-SD-EV-004 keeps triple-draw bluff aggression out of single-draw finals", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "5C", "7H", "8S"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-SD-002 never returns actions outside legalActions", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "AH", "9C", "KD", "QS"],
      }),
      legalActions: ["CHECK"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-D03-EV-001 strong Badugi value bets", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        variantId: "D03",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "3C", "4H"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-D03-EV-002 weak made Badugi does not over-raise", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        variantId: "D03",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "4D", "8C", "QH"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-D03-EV-003 3-card Badugi finals avoid expensive calls", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        variantId: "D03",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "3S", "KH"],
        currentBet: 120,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-007 safe-falls back when no Pro ONNX candidate exists", () => {
    const result = chooseProAction({
      variantId: "B07",
      snapshot: buildSnapshot({
        variantId: "B07",
        street: "BET",
        hand: [],
      }),
      legalActions: ["CHECK", "FOLD"],
      candidateAction: null,
      standardAction: null,
    });
    expect(result).toMatchObject({
      type: "CHECK",
      source: "safe-fallback",
    });
  });

  it("PRO-008 blocks illegal candidateAction and falls back safely", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        street: "BET",
        hand: ["AS", "2D", "3C", "4H"],
      }),
      legalActions: ["CHECK", "CALL"],
      candidateAction: { type: "RAISE", source: "onnx" },
      standardAction: { type: "CALL" },
    });
    expect(["CHECK", "CALL"]).toContain(result.type);
    expect([null, "RAISE"]).toContain(result.blockedAction);
  });

  it("PRO-ROUTE-002 missing Pro model still falls back safely", () => {
    const result = chooseProAction({
      variantId: "B01",
      family: "holdem",
      snapshot: buildSnapshot({
        variantId: "B01",
        street: "BET",
        hand: [],
      }),
      legalActions: ["CHECK", "FOLD"],
    });
    expect(result.source).toBe("safe-fallback");
    expect(result.reason).toBe("unsupported-pro-rules:holdem");
  });

  it("PRO-009 never returns betting actions for all-in actors", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        street: "BET",
        hand: ["AS", "2D", "3C", "4H"],
        allIn: true,
      }),
      legalActions: ["CHECK"],
      candidateAction: { type: "RAISE", source: "onnx" },
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-010 includes reason, source, and confidence", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        street: "BET",
        hand: ["AS", "2D", "3C", "4H"],
        drawRoundIndex: 3,
      }),
      legalActions: ["RAISE", "CHECK"],
    });
    expect(typeof result.reason).toBe("string");
    expect(typeof result.source).toBe("string");
    expect(typeof result.confidence).toBe("number");
  });
});
