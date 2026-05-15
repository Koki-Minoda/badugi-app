import { describe, expect, it } from "vitest";
import { chooseProAction } from "../proDecisionOverlay.js";
import { chooseByFrequency } from "../frequencyControl.js";

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
  pots,
  players = null,
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
    pots,
    players:
      Array.isArray(players) && players.length
        ? players.map((player, index) => ({
            hand: index === actingPlayerIndex ? [...hand] : [...(player?.hand ?? [])],
            allIn: Boolean(player?.allIn),
            stack: typeof player?.stack === "number" ? player.stack : 500,
            betThisRound: typeof player?.betThisRound === "number" ? player.betThisRound : 0,
            folded: Boolean(player?.folded),
            hasFolded: Boolean(player?.hasFolded),
            busted: Boolean(player?.busted),
            isBusted: Boolean(player?.isBusted),
            seatOut: Boolean(player?.seatOut),
            sittingOut: Boolean(player?.sittingOut),
          }))
        : [
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
  it("PRO-FREQ-001 frequency choice is deterministic by seed and context", () => {
    const first = chooseByFrequency({
      seed: 42,
      handId: "AS-2D-3C-4H-5S",
      seatIndex: 2,
      variantId: "S02",
      actionMix: { BET: 70, CHECK: 30 },
      legalActions: ["BET", "CHECK"],
      context: { phase: "single-draw-final" },
    });
    const second = chooseByFrequency({
      seed: 42,
      handId: "AS-2D-3C-4H-5S",
      seatIndex: 2,
      variantId: "S02",
      actionMix: { BET: 70, CHECK: 30 },
      legalActions: ["BET", "CHECK"],
      context: { phase: "single-draw-final" },
    });
    expect(first).toEqual(second);
  });

  it("PRO-FREQ-002 frequency never returns illegal actions", () => {
    const result = chooseByFrequency({
      seed: 42,
      handId: "AS-2D-3C-4H-5S",
      seatIndex: 2,
      variantId: "S02",
      actionMix: { BET: 70, CHECK: 30 },
      legalActions: ["CHECK"],
      context: { phase: "single-draw-final" },
    });
    expect(result.action).toBe("CHECK");
  });

  it("PRO-FREQ-003 frequency reason is recorded", () => {
    const result = chooseByFrequency({
      seed: 99,
      handId: "AS-2D-3C-4H-6S",
      seatIndex: 1,
      variantId: "S02",
      actionMix: { BET: 55, CHECK: 45 },
      legalActions: ["BET", "CHECK"],
      context: { phase: "single-draw-final" },
    });
    expect(result.reason).toMatch(/^frequency-/);
    expect(result.frequencyBucket).toMatch(/\d+\/\d+/);
  });

  it("PRO-FREQ-004 same input returns same action", () => {
    const values = Array.from({ length: 4 }, () =>
      chooseByFrequency({
        seed: 7,
        handId: "2S-3D-4C-6H-8S",
        seatIndex: 0,
        variantId: "S01",
        actionMix: { CALL: 35, FOLD: 65 },
        legalActions: ["FOLD", "CALL"],
        context: { phase: "single-draw-final", facingBet: true },
      }).action,
    );
    expect(new Set(values).size).toBe(1);
  });

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

  it("PRO-D02-D-001 wheel always pats", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        hand: ["AS", "2D", "3C", "4H", "5S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-D02-D-002 smooth 7-low value bets", () => {
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

  it("PRO-D02-D-003 rough 8-low does not raise final", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "4D", "5C", "7H", "8S"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-D02-D-004 9-low folds facing expensive bets", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "3D", "6C", "8H", "9S"],
        currentBet: 120,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-E-001 weakA5 folds facing bets", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "4D", "6C", "8H", "9S"],
        currentBet: 20,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-E-002 trashA5 never calls", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AS", "AH", "QC", "9H", "7S"],
        currentBet: 10,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-E-003 mediumA5 folds versus large bets", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "4C", "6H", "8S"],
        currentBet: 120,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-E-004 paired hands avoid final calls", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "AH", "3C", "5H", "7S"],
        currentBet: 20,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-E-005 only allows mediumA5 calls for small bets", () => {
    const smallBet = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "3C", "4H", "7S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    const largeBet = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "3C", "4H", "7S"],
        currentBet: 120,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(smallBet.type).toBe("CALL");
    expect(largeBet.type).toBe("FOLD");
  });

  it("PRO-D02-F-001 strongA5 calls a small bet", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "3D", "4C", "5H", "7S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-D02-F-002 strongA5 folds repeated large bet pressure", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AS", "3D", "4C", "5H", "7S"],
        currentBet: 40,
        pots: [{ amount: 60 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-F-003 premiumA5 still value bets", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "3C", "4H", "5S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-D02-F-004 weakA5 and trashA5 still do not call facing bets", () => {
    const weak = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AS", "4D", "6C", "8H", "9S"],
        currentBet: 10,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    const trash = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AS", "AH", "QC", "9H", "7S"],
        currentBet: 10,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(weak.type).toBe("FOLD");
    expect(trash.type).toBe("FOLD");
  });

  it("PRO-D02-D-005 paired final hand avoids calls", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "AH", "3C", "5H", "7S"],
        currentBet: 40,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-D-006 ignores straight and flush penalties for A-5", () => {
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

  it("PRO-D02-S-001 strongA5 calls first small pressure", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "3D", "4C", "5H", "7S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "3C", "4H", "7S"] },
          { betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-D02-S-002 strongA5 folds repeated medium pressure", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "4C", "5H", "7S"],
        currentBet: 30,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "3C", "4H", "7S"] },
          { betThisRound: 30, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-S-003 strongA5 folds large pressure", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AS", "3D", "4C", "5H", "7S"],
        currentBet: 80,
        betThisRound: 0,
        pots: [{ amount: 80 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-S-004 strongA5 first-in value bet is preserved", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "3D", "4C", "5H", "7S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-D02-S-101 upper mediumA5 may call a small bet", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "2D", "3C", "4H", "7S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "4C", "6H", "8S"] },
          { betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-D02-S-102 rough 8-low folds medium pressure", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "3D", "5C", "7H", "8S"],
        currentBet: 30,
        betThisRound: 0,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-S-103 9-low folds facing bets", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "3D", "6C", "8H", "9S"],
        currentBet: 10,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-S-104 paired final hands fold facing bets", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "AH", "3C", "5H", "7S"],
        currentBet: 20,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-S-105 mediumA5 never raises", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "4C", "6H", "8S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).not.toBe("RAISE");
  });

  it("PRO-D02-S-201 wheel value line is preserved", () => {
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

  it("PRO-D02-S-202 6-low value line is preserved", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "2D", "3C", "4H", "6S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-D02-S-203 straight and flush are still not penalized", () => {
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

  it("PRO-D02-S-204 ace remains low", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        hand: ["AS", "2D", "3C", "4H", "6S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-D02-V-001 strongA5 safe second-pressure does not auto-fold", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "4C", "5H", "7S"],
        currentBet: 12,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "4C", "5H", "7S"] },
          { betThisRound: 12, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(["CALL", "RAISE"]).toContain(result.type);
  });

  it("PRO-D02-V-002 strongA5 may raise safe second-pressure", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "4C", "5H", "7S"],
        currentBet: 12,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "4C", "5H", "7S"] },
          { betThisRound: 12, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-D02-V-003 strongA5 still folds large repeated pressure", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AS", "3D", "4C", "5H", "7S"],
        currentBet: 50,
        betThisRound: 0,
        pots: [{ amount: 70 }],
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "4C", "5H", "7S"] },
          { betThisRound: 50, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-V-004 medium, weak, and trash defense remains tight", () => {
    const medium = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "5C", "7H", "8S"],
        currentBet: 20,
        betThisRound: 0,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    const weak = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "6C", "8H", "9S"],
        currentBet: 10,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(medium.type).toBe("FOLD");
    expect(weak.type).toBe("FOLD");
  });

  it("PRO-D02-V-005 premiumA5 value line preserved", () => {
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

  it("PRO-S01-I-001 clean 7-low pats", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        hand: ["2S", "3H", "4C", "5D", "7S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-S01-I-002 smooth 8-low pats", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        hand: ["2S", "3H", "4C", "6D", "8S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-S01-I-003 pair discards", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        hand: ["2S", "2H", "4C", "6D", "8S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes.length).toBe(1);
    expect(result.discardIndexes).toContain(1);
  });

  it("PRO-S01-I-004 straight or flush penalty hands do not get overvalued", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        hand: ["3S", "4H", "5C", "6D", "7S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes.length).toBe(1);
  });

  it("PRO-S01-I-005 ace is not treated as low", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        hand: ["AS", "2H", "3C", "4D", "7S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes.length).toBeGreaterThan(0);
    expect(result.discardIndexes).toContain(0);
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

  it("PRO-D02-X-001 strongA5 safe second-pressure can raise", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AD", "2S", "3H", "5C", "7D"],
        currentBet: 16,
        betThisRound: 0,
        pots: [{ amount: 120 }],
        players: [
          { betThisRound: 0, hand: ["AD", "2S", "3H", "5C", "7D"] },
          { betThisRound: 16, hand: ["KC"] },
          { betThisRound: 16, hand: ["QD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-D02-X-002 strongA5 safe second-pressure can call without raise", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AD", "2S", "3H", "5C", "7D"],
        currentBet: 16,
        betThisRound: 0,
        pots: [{ amount: 120 }],
        players: [
          { betThisRound: 0, hand: ["AD", "2S", "3H", "5C", "7D"] },
          { betThisRound: 16, hand: ["KC"] },
          { betThisRound: 16, hand: ["QD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-D02-X-003 strongA5 still folds dangerous multiway pressure", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AD", "2S", "3H", "5C", "7D"],
        currentBet: 20,
        betThisRound: 0,
        pots: [{ amount: 120 }],
        players: [
          { betThisRound: 0, hand: ["AD", "2S", "3H", "5C", "7D"] },
          { betThisRound: 20, hand: ["KC"] },
          { betThisRound: 20, hand: ["QD"] },
          { betThisRound: 20, hand: ["JH"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-X-004 medium, weak, and trash defense remains unchanged", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "6C", "8H", "9S"],
        currentBet: 20,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "6C", "8H", "9S"] },
          { betThisRound: 20, hand: ["KC"] },
          { betThisRound: 20, hand: ["QD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-X-005 premiumA5 value line preserved", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "5S"],
        currentBet: 16,
        betThisRound: 0,
        pots: [{ amount: 120 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "3C", "4H", "5S"] },
          { betThisRound: 16, hand: ["KC"] },
          { betThisRound: 16, hand: ["QD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S01-I-101 premiumSD27 bets when legal", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3H", "4C", "5D", "7S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-D02-Z-001 dataset-backed strongA5 second-pressure raises when safe", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AD", "2S", "3H", "5C", "7D"],
        currentBet: 15,
        betThisRound: 0,
        pots: [{ amount: 140 }],
        players: [
          { betThisRound: 0, hand: ["AD", "2S", "3H", "5C", "7D"] },
          { betThisRound: 15, hand: ["KC"] },
          { betThisRound: 15, hand: ["QD"] },
          { betThisRound: 15, hand: ["JH"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-D02-Z-002 dataset-backed strongA5 second-pressure calls when raise is illegal", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AD", "2S", "3H", "5C", "7D"],
        currentBet: 15,
        betThisRound: 0,
        pots: [{ amount: 140 }],
        players: [
          { betThisRound: 0, hand: ["AD", "2S", "3H", "5C", "7D"] },
          { betThisRound: 15, hand: ["KC"] },
          { betThisRound: 15, hand: ["QD"] },
          { betThisRound: 15, hand: ["JH"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-D02-Z-003 strongA5 folds unsafe large repeated pressure", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AD", "2S", "3H", "5C", "7D"],
        currentBet: 40,
        betThisRound: 0,
        pots: [{ amount: 120 }],
        players: [
          { betThisRound: 0, hand: ["AD", "2S", "3H", "5C", "7D"] },
          { betThisRound: 40, hand: ["KC"] },
          { betThisRound: 40, hand: ["QD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-Z-004 mediumA5 weak-trim defense remains unchanged", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AS", "3D", "6C", "8H", "9S"],
        currentBet: 20,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "6C", "8H", "9S"] },
          { betThisRound: 20, hand: ["KC"] },
          { betThisRound: 20, hand: ["QD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-Z-005 premiumA5 value line unchanged", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AD", "2S", "3H", "4C", "6D"],
        currentBet: 0,
        betThisRound: 0,
        pots: [{ amount: 120 }],
        players: [{ betThisRound: 0, hand: ["AD", "2S", "3H", "4C", "6D"] }],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-D02-Z-006 D01, S01, and S02 remain unaffected", () => {
    const d01 = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["2S", "3D", "4C", "5H", "7D"],
        currentBet: 0,
        pots: [{ amount: 120 }],
        players: [{ betThisRound: 0, hand: ["2S", "3D", "4C", "5H", "7D"] }],
      }),
      legalActions: ["BET", "CHECK"],
    });
    const s01 = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3D", "4C", "7H", "8D"],
        currentBet: 0,
        pots: [{ amount: 100 }],
        players: [{ betThisRound: 0, hand: ["2S", "3D", "4C", "7H", "8D"] }],
      }),
      legalActions: ["BET", "CHECK"],
    });
    const s02 = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AD", "2S", "3H", "4C", "6D"],
        currentBet: 0,
        pots: [{ amount: 100 }],
        players: [{ betThisRound: 0, hand: ["AD", "2S", "3H", "4C", "6D"] }],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(d01.type).toBe("BET");
    expect(s01.type).toBe("BET");
    expect(s02.type).toBe("BET");
  });

  it("PRO-S01-I-102 premiumSD27 may raise facing bets", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3H", "4C", "5D", "7S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-S01-I-103 strongSD27 bets first in", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "5C", "7D", "8S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S01-I-104 mediumSD27 does not raise", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "6C", "7D", "10S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(["CALL", "FOLD"]).toContain(result.type);
  });

  it("PRO-S01-I-105 weakSD27 folds facing bets", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "5H", "7C", "9D", "QS"],
        currentBet: 20,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-I-106 trashSD27 never calls facing bets", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "2H", "4C", "6D", "8S"],
        currentBet: 10,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-I-107 penalty hands do not value bet", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["3S", "4H", "5C", "6D", "7S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-S01-J-001 rough 8-low bets first in", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "5C", "7D", "8S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S01-J-002 smooth 9-low bets first in", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "6C", "7D", "9S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S01-J-003 strongSD27 does not over-raise facing large bets", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3H", "5C", "7D", "9S"],
        currentBet: 80,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(["CALL", "FOLD"]).toContain(result.type);
    expect(result.type).not.toBe("RAISE");
  });

  it("PRO-S01-J-004 strongSD27 calls small and medium bets", () => {
    const small = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "6C", "7D", "9S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    const medium = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "6C", "7D", "9S"],
        currentBet: 20,
        pots: [{ amount: 60 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(small.type).toBe("CALL");
    expect(medium.type).toBe("CALL");
  });

  it("PRO-S01-J-101 rough 9-low only calls small bets", () => {
    const small = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "5C", "7D", "9S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    const medium = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "5C", "7D", "9S"],
        currentBet: 20,
        pots: [{ amount: 60 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(small.type).toBe("CALL");
    expect(medium.type).toBe("FOLD");
  });

  it("PRO-S01-J-102 T-low folds facing bets", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "6C", "8D", "10S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-J-103 mediumSD27 folds facing large bets", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "6C", "8D", "9S"],
        currentBet: 80,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-J-104 mediumSD27 never raises", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "6C", "8D", "9S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).not.toBe("RAISE");
  });

  it("PRO-S01-J-201 pair hands never value-bet", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "2H", "4C", "6D", "8S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-S01-J-202 straight hands avoid final calls", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["3S", "4H", "5C", "6D", "7S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-J-203 flush hands avoid final calls", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4S", "6S", "8S", "9S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-J-204 ace-high low is not treated as A-5 low", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2H", "4C", "6D", "8S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-K-001 upper strongSD27 value bets first in", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "5C", "7D", "8S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
    expect(result.reason).toMatch(/strong.*value-bet/);
  });

  it("PRO-S01-K-002 upper strongSD27 can thin raise when legal", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "5C", "7D", "8S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-S01-K-003 upper strongSD27 folds to large pressure", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "6C", "7D", "9S"],
        currentBet: 80,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-K-004 rough 9-low is not treated as upper strong", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["3S", "5H", "7C", "8D", "9S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-S01-K-101 upper rough 9-low may call small bets", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "5C", "7D", "9S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S01-K-102 upper rough 9-low folds medium or large bets", () => {
    const medium = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "5C", "7D", "9S"],
        currentBet: 20,
        pots: [{ amount: 60 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    const large = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "5C", "7D", "9S"],
        currentBet: 80,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(medium.type).toBe("FOLD");
    expect(large.type).toBe("FOLD");
  });

  it("PRO-S01-K-103 lower rough 9-low folds facing bets", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["4S", "6H", "7C", "8D", "9S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-K-104 rough 9-low never raises", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "5C", "7D", "9S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).not.toBe("RAISE");
  });

  it("PRO-S01-K-105 T-low remains check or fold", () => {
    const open = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "6C", "8D", "10S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    const facing = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "6C", "8D", "10S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(open.type).toBe("CHECK");
    expect(facing.type).toBe("FOLD");
  });

  it("PRO-S01-K-201 pair remains trash", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "2H", "4C", "6D", "8S"],
        currentBet: 10,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-K-202 straight remains penalty", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["3S", "4H", "5C", "6D", "7S"],
        currentBet: 10,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-K-203 flush remains penalty", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4S", "6S", "8S", "9S"],
        currentBet: 10,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-K-204 ace remains high in S01", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2H", "4C", "6D", "8S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("CHECK");
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

  it("PRO-D01-D-001 keeps smooth 8-low as a value candidate", () => {
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

  it("PRO-D01-D-002 penalty hands avoid final overcalls", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["3S", "4H", "5C", "6D", "7S"],
        currentBet: 80,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D01-D-003 9-low does not over-defend", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "4H", "6C", "7D", "9S"],
        currentBet: 60,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D01-F-001 rough 8-low only calls small bets", () => {
    const small = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3D", "6C", "7H", "8S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    const large = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3D", "6C", "7H", "8S"],
        currentBet: 40,
        pots: [{ amount: 60 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(small.type).toBe("CALL");
    expect(large.type).toBe("FOLD");
  });

  it("PRO-D01-F-002 9-low folds facing bets", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3D", "4C", "7H", "9S"],
        currentBet: 10,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D01-F-003 penalty hands fold facing pressure", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3S", "4S", "5S", "6S"],
        currentBet: 20,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D01-F-004 strong 7-low value line remains", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3D", "4C", "5H", "7S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-D01-O-001 rough 8-low calls small bets only", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3D", "6C", "7H", "8S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-D01-O-002 rough 8-low folds large pressure", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3D", "6C", "7H", "8S"],
        currentBet: 40,
        pots: [{ amount: 40 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D01-O-003 rough 9-low folds medium or large bets", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "5D", "6C", "7H", "9S"],
        currentBet: 20,
        pots: [{ amount: 50 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D01-O-004 T-low folds facing bets", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "4D", "6C", "7H", "10S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D01-O-005 penalty hands do not call final bets", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3S", "4S", "5S", "7S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D01-O-101 clean 7-low value bets", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3D", "4C", "5H", "7S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-D01-O-102 smooth 8-low value bets", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3D", "4C", "6H", "8S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-D01-O-103 premium27TD may raise when legal", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3D", "4C", "5H", "7S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["CALL", "RAISE", "FOLD"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-D01-O-104 strong27TD does not overfold small pressure", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3D", "6C", "7H", "8S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-D01-O-201 pair discards", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "DRAW",
        drawRoundIndex: 1,
        hand: ["2S", "2D", "5C", "7H", "9S"],
      }),
      legalActions: [{ type: "DRAW", maxCards: 3 }],
    });
    expect(result.type).toBe("DRAW");
    expect(result.discardIndexes.length).toBeGreaterThan(0);
  });

  it("PRO-D01-O-202 straight or flush penalties are broken while drawing", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "DRAW",
        drawRoundIndex: 1,
        hand: ["3S", "4S", "5S", "6S", "7S"],
      }),
      legalActions: [{ type: "DRAW", maxCards: 3 }],
    });
    expect(result.type).toBe("DRAW");
    expect(result.discardIndexes.length).toBeGreaterThan(0);
  });

  it("PRO-D01-O-203 high cards are discarded", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "DRAW",
        drawRoundIndex: 1,
        hand: ["2S", "4D", "6C", "9H", "KS"],
      }),
      legalActions: [{ type: "DRAW", maxCards: 3 }],
    });
    expect(result.type).toBe("DRAW");
    expect(result.discardIndexes).toContain(4);
  });

  it("PRO-D01-O-204 clean 7-low pats", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "DRAW",
        drawRoundIndex: 2,
        hand: ["2S", "3D", "4C", "5H", "7S"],
      }),
      legalActions: [{ type: "DRAW", maxCards: 3 }],
    });
    expect(result.type).toBe("DRAW");
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-D01-O-205 ace is treated as high", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "DRAW",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
      }),
      legalActions: [{ type: "DRAW", maxCards: 3 }],
    });
    expect(result.type).toBe("DRAW");
    expect(result.discardIndexes).toContain(0);
  });

  it("PRO-S01-P-001 trashSD27 blocks standard-rule CALL facing bets", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "2D", "5C", "7H", "9S"],
        currentBet: 20,
        betThisRound: 0,
        players: new Array(6).fill(null).map((_, index) => ({
          name: `CPU ${index + 1}`,
          folded: false,
          allIn: false,
        })),
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    expect(result.type).toBe("FOLD");
    expect(result.reason).toBe("s01-trash-early-multiway-call-guard-fold");
    expect(result.blockedAction).toBe("CALL");
  });

  it("PRO-S01-P-002 weakSD27 blocks candidate CALL facing bets", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "4D", "7C", "9H", "QS"],
        currentBet: 20,
        betThisRound: 0,
        players: new Array(5).fill(null).map((_, index) => ({
          name: `CPU ${index + 1}`,
          folded: false,
          allIn: false,
        })),
      }),
      legalActions: ["FOLD", "CALL"],
      candidateAction: { type: "CALL", source: "onnx", reason: "candidate-call" },
    });
    expect(result.type).toBe("FOLD");
    expect(result.reason).toBe("s01-weak-early-multiway-call-guard-fold");
    expect(result.blockedAction).toBe("CALL");
  });

  it("PRO-S01-P-003 lowerMediumSD27 folds multiway facing pressure", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "4D", "6C", "7H", "10S"],
        currentBet: 20,
        betThisRound: 0,
        players: new Array(6).fill(null).map((_, index) => ({
          name: `CPU ${index + 1}`,
          folded: false,
          allIn: false,
        })),
      }),
      legalActions: ["FOLD", "CALL"],
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    expect(result.type).toBe("FOLD");
    expect(result.reason).toMatch(/s01-(tlow|lower-medium).*-fold/);
    expect(result.blockedAction).toBe("CALL");
  });

  it("PRO-S01-P-004 upperMediumSD27 may call small bets only", () => {
    const small = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "4D", "5C", "6H", "9S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    const medium = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "4D", "5C", "6H", "9S"],
        currentBet: 20,
        pots: [{ amount: 50 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(small.type).toBe("CALL");
    expect(medium.type).toBe("FOLD");
  });

  it("PRO-S01-P-005 T-low folds facing bets", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "4D", "6C", "7H", "10S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-P-006 straight, flush, and pair hands never inherit CALL", () => {
    const straight = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["3S", "4H", "5C", "6D", "7S"],
        currentBet: 20,
      }),
      legalActions: ["FOLD", "CALL"],
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    const flush = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "5S", "7S", "9S", "JS"],
        currentBet: 20,
      }),
      legalActions: ["FOLD", "CALL"],
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    const pair = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "2D", "5C", "7H", "9S"],
        currentBet: 20,
      }),
      legalActions: ["FOLD", "CALL"],
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    expect(straight.type).toBe("FOLD");
    expect(flush.type).toBe("FOLD");
    expect(pair.type).toBe("FOLD");
  });

  it("PRO-S01-P-007 ace-high low is not treated as A-5 low", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 20,
      }),
      legalActions: ["FOLD", "CALL"],
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-P-101 clean 7-low value line preserved", () => {
    const open = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3D", "4C", "5H", "7S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    const facing = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3D", "4C", "5H", "7S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(open.type).toBe("BET");
    expect(["CALL", "RAISE"]).toContain(facing.type);
  });

  it("PRO-S01-P-102 smooth 8-low value line preserved", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3D", "4C", "6H", "8S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S01-P-103 rough 8-low first-in value preserved", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3D", "6C", "7H", "8S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S01-P-104 strongSD27 does not overfold small pressure", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3D", "6C", "7H", "8S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S01-P-105 strongSD27 folds large multiway early pressure", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "3D", "6C", "7H", "8S"],
        currentBet: 20,
        pots: [{ amount: 40 }],
        players: new Array(6).fill(null).map((_, index) => ({
          name: `CPU ${index + 1}`,
          folded: false,
          allIn: false,
        })),
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-V-001 top-end strongSD27 retains call under safe pressure", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "4D", "6C", "7H", "9S"],
        currentBet: 12,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["2S", "4D", "6C", "7H", "9S"] },
          { betThisRound: 12, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S01-V-002 top-end strongSD27 folds large pressure", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4D", "6C", "7H", "9S"],
        currentBet: 60,
        betThisRound: 0,
        pots: [{ amount: 80 }],
        players: [
          { betThisRound: 0, hand: ["2S", "4D", "6C", "7H", "9S"] },
          { betThisRound: 60, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-V-003 trash and weak call guard remains active", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "2D", "9C", "TD", "QS"],
        currentBet: 20,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
      candidateAction: { type: "CALL", source: "standard-rule" },
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-V-004 straight and flush penalty preserved", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3S", "4S", "5S", "7S"],
        currentBet: 10,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-V-005 ace remains high", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        hand: ["AS", "2D", "3C", "4H", "8S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes.length).toBeGreaterThan(0);
  });

  it("PRO-S01-X-001 top-end strongSD27 retains call under safe medium pressure", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "4D", "6C", "7H", "9S"],
        currentBet: 20,
        betThisRound: 0,
        pots: [{ amount: 140 }],
        players: [
          { betThisRound: 0, hand: ["2S", "4D", "6C", "7H", "9S"] },
          { betThisRound: 20, hand: ["KC"] },
          { betThisRound: 20, hand: ["QD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S01-X-002 top-end strongSD27 folds large pressure", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "4D", "6C", "7H", "9S"],
        currentBet: 40,
        betThisRound: 0,
        pots: [{ amount: 60 }],
        players: [
          { betThisRound: 0, hand: ["2S", "4D", "6C", "7H", "9S"] },
          { betThisRound: 40, hand: ["KC"] },
          { betThisRound: 40, hand: ["QD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-X-003 trash and weak guard stays active", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["2S", "2D", "9C", "TD", "QS"],
        currentBet: 20,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
      candidateAction: { type: "CALL", source: "standard-rule" },
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S01-X-004 ace remains high", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        hand: ["AS", "2D", "3C", "4H", "8S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes.length).toBeGreaterThan(0);
  });

  it("PRO-S01-X-005 straight and flush penalty preserved", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3S", "4S", "5S", "7S"],
        currentBet: 10,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-P-001 S02 straight or flush is still not penalized", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "DRAW",
        drawRoundIndex: 0,
        hand: ["AS", "2S", "3S", "4S", "5S"],
      }),
      legalActions: [{ type: "DRAW", maxCards: 3 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-D01-P-001 D01 fallback CALL guard remains active", () => {
    const result = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "5D", "6C", "7H", "9S"],
        currentBet: 20,
        pots: [{ amount: 50 }],
      }),
      legalActions: ["FOLD", "CALL"],
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-P-001 D02 weak or trash A-5 defense remains tight", () => {
    const result = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "4D", "7C", "9H", "QS"],
        currentBet: 20,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-SD-D-001 strong single-draw lows value bet", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "5H", "7S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-SD-D-002 medium single-draw lows check or call, not raise", () => {
    const unopened = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "5C", "7D", "8S"],
      }),
      legalActions: ["CHECK", "RAISE"],
    });
    const facing = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "4H", "5C", "7D", "8S"],
        currentBet: 20,
        betThisRound: 0,
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(unopened.type).toBe("CHECK");
    expect(facing.type).toBe("CALL");
  });

  it("PRO-SD-D-003 weak single-draw lows fold facing bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "4D", "6C", "8H", "9S"],
        currentBet: 80,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-SD-D-004 prevents triple-draw aggression leaks", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "4D", "5C", "7H", "8S"],
        currentBet: 20,
        betThisRound: 0,
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-SD-F-001 premium single-draw hands may raise", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "5S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-SD-F-002 strong single-draw hands value bet", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-SD-F-003 medium hands do not raise", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "6H", "8S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-SD-F-004 weak hands fold to pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "4D", "6C", "8H", "9S"],
        currentBet: 20,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-SD-F-005 no triple-draw defense leakage", () => {
    const result = chooseProAction({
      variantId: "S01",
      snapshot: buildSnapshot({
        variantId: "S01",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["2S", "3D", "6C", "7H", "8S"],
        currentBet: 40,
        pots: [{ amount: 60 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-FREQ-H-001 frequency helper exists but is not used by default for S02 final betting", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "5S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
    expect(result.metadata?.frequencyControlled).not.toBe(true);
  });

  it("PRO-S02-H-000 Step4-G frequency path does not override deterministic value line", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
    expect(result.reason).toBe("s02-premium-sd-final-value-bet");
  });

  it("PRO-S02-G-001 premium A-5 single draw value bets deterministically", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "5S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-G-002 strong A-5 single draw does not over-check", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "5H", "7S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-G-003 medium A-5 does not raise", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "6H", "8S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(["CALL", "FOLD"]).toContain(result.type);
  });

  it("PRO-S02-G-004 weak A-5 still folds or checks", () => {
    const facing = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "4D", "6C", "8H", "9S"],
        currentBet: 20,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    const unopened = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "4D", "6C", "8H", "9S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(facing.type).toBe("FOLD");
    expect(unopened.type).toBe("CHECK");
  });

  it("PRO-S02-G-005 triple-draw defense does not leak back", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "6H", "8S"],
        currentBet: 60,
        pots: [{ amount: 80 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).not.toBe("RAISE");
  });

  it("PRO-S02-H-001 wheel pats", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["AS", "2D", "3C", "4H", "5S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-S02-H-002 6-low pats", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["AS", "2D", "3C", "4H", "6S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-S02-H-003 smooth 7-low pats", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["AS", "2D", "3C", "5H", "7S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-S02-H-004 paired hands discard the pair", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["AS", "AH", "3C", "4H", "7S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes.length).toBe(1);
  });

  it("PRO-S02-H-005 straight and flush structure is not penalized", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["2S", "3S", "4S", "5S", "6S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-S02-H-101 premiumSDA5 bets when legal", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "5S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-H-102 premiumSDA5 raises facing bets when legal", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "5S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-S02-H-103 strongSDA5 bets when first in", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "5H", "7S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-H-104 strongSDA5 calls small or medium bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "5H", "7S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S02-H-105 mediumSDA5 does not raise", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        currentBet: 10,
        pots: [{ amount: 100 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(["CALL", "FOLD"]).toContain(result.type);
  });

  it("PRO-S02-H-106 weakSDA5 folds facing bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "4D", "6C", "8H", "9S"],
        currentBet: 20,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-H-107 trashSDA5 never calls facing bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "AH", "QC", "9H", "7S"],
        currentBet: 10,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-L-001 premiumSDA5 bets first in", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-L-002 premiumSDA5 may raise facing small bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-S02-L-003 strongSDA5 bets first in", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-L-004 strongSDA5 calls small and medium bets", () => {
    const small = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    const medium = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 20,
        pots: [{ amount: 60 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(["CALL", "RAISE"]).toContain(small.type);
    expect(medium.type).toBe("CALL");
  });

  it("PRO-S02-L-005 strongSDA5 folds to large pressure when not premium", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 80,
        pots: [{ amount: 60 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-L-101 upperMediumSDA5 may call small bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S02-L-102 upperMediumSDA5 does not raise", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(["CALL", "FOLD"]).toContain(result.type);
  });

  it("PRO-S02-L-103 lowerMediumSDA5 folds medium or large bets", () => {
    const medium = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "5D", "6C", "7H", "8S"],
        currentBet: 20,
        pots: [{ amount: 60 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    const large = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "5D", "6C", "7H", "8S"],
        currentBet: 80,
        pots: [{ amount: 60 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(medium.type).toBe("FOLD");
    expect(large.type).toBe("FOLD");
  });

  it("PRO-S02-L-104 weakSDA5 folds facing bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "4D", "6C", "8H", "9S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-L-105 trashSDA5 never calls facing bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "AH", "QC", "9H", "7S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-L-201 wheel pats", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["AS", "2D", "3C", "4H", "5S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-S02-L-202 6-low pats", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["AS", "2D", "3C", "4H", "6S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-S02-L-203 clean 7-low pats", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["AS", "2D", "4C", "5H", "7S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-S02-L-204 pair discards", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["AS", "AH", "3C", "4H", "8S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes.length).toBe(1);
  });

  it("PRO-S02-L-205 straight and flush are not penalized", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["2S", "3S", "4S", "5S", "6S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-S02-M-001 premiumSDA5 value raises only in safe pressure spots", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
        players: [
          { stack: 300, folded: false, allIn: false, betThisRound: 0, hand: ["AS", "2D", "3C", "4H", "6S"] },
          { stack: 300, folded: true, allIn: false, betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-S02-M-002 premiumSDA5 does not over-raise multiway large pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
        currentBet: 60,
        pots: [{ amount: 80 }],
        players: [
          { stack: 300, folded: false, betThisRound: 0, hand: ["AS", "2D", "3C", "4H", "6S"] },
          { stack: 300, folded: false, betThisRound: 60, hand: ["KC"] },
          { stack: 300, folded: false, betThisRound: 60, hand: ["QD"] },
          { stack: 300, folded: false, betThisRound: 60, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S02-M-003 strongSDA5 does not raise multiway facing bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
        players: [
          { stack: 300, folded: false, betThisRound: 0, hand: ["AS", "2D", "4C", "5H", "7S"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["KC"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["QD"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S02-M-004 upperMediumSDA5 checks multiway first in", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        players: [
          { stack: 300, folded: false, betThisRound: 0, hand: ["AS", "3D", "5C", "6H", "8S"] },
          { stack: 300, folded: false, betThisRound: 0, hand: ["KC"] },
          { stack: 300, folded: false, betThisRound: 0, hand: ["QD"] },
          { stack: 300, folded: false, betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-S02-M-005 weak and trash hands still fold facing bets", () => {
    const weak = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "4D", "6C", "8H", "9S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    const trash = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "AH", "QC", "9H", "7S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(weak.type).toBe("FOLD");
    expect(trash.type).toBe("FOLD");
  });

  it("PRO-S02-M-006 frequency remains disabled for S02 main path", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.metadata?.frequencyControlled).not.toBe(true);
  });

  it("PRO-S02-N-001 trashSDA5 blocks standard-rule CALL facing bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "AH", "QC", "9H", "7S"],
        currentBet: 10,
        players: [
          { stack: 300, folded: false, betThisRound: 0, hand: ["AS", "AH", "QC", "9H", "7S"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["KC"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["QD"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    expect(result.type).toBe("FOLD");
    expect(result.blockedAction).toBe("CALL");
    expect(result.reason).toBe("s02-trash-early-multiway-call-guard-fold");
  });

  it("PRO-S02-N-002 weakSDA5 blocks candidate CALL facing bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "4D", "6C", "8H", "9S"],
        currentBet: 10,
        players: [
          { stack: 300, folded: false, betThisRound: 0, hand: ["AS", "4D", "6C", "8H", "9S"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["KC"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["QD"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
      candidateAction: { type: "CALL", source: "onnx", reason: "candidate-call" },
    });
    expect(result.type).toBe("FOLD");
    expect(result.blockedAction).toBe("CALL");
    expect(result.reason).toBe("s02-weak-early-multiway-call-guard-fold");
  });

  it("PRO-S02-N-003 lowerMediumSDA5 folds 4way facing pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "5D", "6C", "7H", "8S"],
        currentBet: 10,
        players: [
          { stack: 300, folded: false, betThisRound: 0, hand: ["AS", "5D", "6C", "7H", "8S"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["KC"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["QD"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    expect(result.type).toBe("FOLD");
    expect(result.blockedAction).toBe("CALL");
  });

  it("PRO-S02-N-004 premiumSDA5 value line is preserved", () => {
    const open = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    const facing = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(open.type).toBe("BET");
    expect(facing.type).toBe("RAISE");
  });

  it("PRO-S02-N-005 strongSDA5 value line is preserved", () => {
    const open = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
      }),
      legalActions: ["BET", "CHECK"],
    });
    const facing = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 20,
        pots: [{ amount: 60 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(open.type).toBe("BET");
    expect(facing.type).toBe("CALL");
  });

  it("PRO-S02-N-006 upperMediumSDA5 may still call small bets heads-up", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        currentBet: 10,
        pots: [{ amount: 120 }],
        players: [
          { stack: 300, folded: false, betThisRound: 0, hand: ["AS", "3D", "5C", "6H", "8S"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["KC"] },
          { stack: 300, folded: true, betThisRound: 0, hand: ["QD"] },
          { stack: 300, folded: true, betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S02-N-007 standard-rule CALL blocks record reason and blockedAction", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "AH", "QC", "9H", "7S"],
        currentBet: 10,
        players: [
          { stack: 300, folded: false, betThisRound: 0, hand: ["AS", "AH", "QC", "9H", "7S"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["KC"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["QD"] },
          { stack: 300, folded: false, betThisRound: 10, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    expect(result.reason).toMatch(/call-guard-fold/);
    expect(result.blockedAction).toBe("CALL");
  });

  it("PRO-S02-N-008 frequency remains disabled for S02 main path", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "AH", "QC", "9H", "7S"],
        currentBet: 10,
      }),
      legalActions: ["FOLD", "CALL"],
      standardAction: { type: "CALL", reason: "standard-fallback" },
    });
    expect(result.metadata?.frequencyControlled).not.toBe(true);
  });

  it("PRO-S02-Q-001 premiumSDA5 always value-bets first in", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
        players: [{}, {}],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-Q-002 premiumSDA5 may raise small or medium pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
        currentBet: 20,
        betThisRound: 0,
        pots: [{ amount: 80 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "3C", "4H", "6S"] },
          { betThisRound: 30, hand: ["KC"] },
        ],
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-S02-Q-003 premiumSDA5 avoids reckless raises under large repeated pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "3C", "4H", "6S"],
        currentBet: 120,
        betThisRound: 0,
        pots: [{ amount: 80 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "3C", "4H", "6S"] },
          { betThisRound: 120, hand: ["KC"] },
        ],
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S02-Q-004 premiumSDA5 is not affected by the trash-call guard", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "2D", "3C", "4H", "6S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "3C", "4H", "6S"] },
          { betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(["CALL", "RAISE"]).toContain(result.type);
  });

  it("PRO-S02-Q-101 strongSDA5 value-bets first in", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        players: [{}, {}],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-Q-101B strongSDA5 may value-bet early when first in", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        players: [{}, {}, {}, {}],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-Q-102 strongSDA5 may thin-raise heads-up small pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "4C", "5H", "7S"] },
          { betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-S02-Q-103 strongSDA5 does not over-raise 4way pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "4C", "5H", "7S"] },
          { betThisRound: 10, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["CALL", "RAISE", "FOLD"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S02-Q-104 strongSDA5 folds or calls correctly under large pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 120,
        betThisRound: 0,
        pots: [{ amount: 80 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "4C", "5H", "7S"] },
          { betThisRound: 120, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-Q-201 upperMediumSDA5 may bet heads-up first in", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        players: [{}, {}],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-Q-202 upperMediumSDA5 checks multiway first in", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        players: [{}, {}, {}, {}],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-S02-Q-203 upperMediumSDA5 calls small bets only", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "5C", "6H", "8S"] },
          { betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S02-Q-204 upperMediumSDA5 never raises", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "5C", "6H", "8S"] },
          { betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["CALL", "RAISE", "FOLD"],
    });
    expect(result.type).not.toBe("RAISE");
  });

  it("PRO-S02-Q-205 lowerMedium, weak, and trash call guards remain active", () => {
    const lowerMedium = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "4D", "5C", "7H", "8S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "4D", "5C", "7H", "8S"] },
          { betThisRound: 10, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
      candidateAction: { type: "CALL", source: "standard-rule" },
    });
    expect(lowerMedium.type).toBe("FOLD");
  });

  it("PRO-S02-Q-301 trashSDA5 still blocks standard CALL", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "AH", "9C", "TD", "QS"],
        currentBet: 20,
        betThisRound: 0,
        players: [
          { betThisRound: 0, hand: ["AS", "AH", "9C", "TD", "QS"] },
          { betThisRound: 20, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
      candidateAction: { type: "CALL", source: "standard-rule" },
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-Q-302 weakSDA5 still blocks candidate CALL", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "3D", "6C", "9H", "TS"],
        currentBet: 20,
        betThisRound: 0,
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "6C", "9H", "TS"] },
          { betThisRound: 20, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
      candidateAction: { type: "CALL", source: "onnx" },
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-Q-303 lowerMediumSDA5 still folds multiway pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "4D", "5C", "7H", "8S"],
        currentBet: 20,
        betThisRound: 0,
        players: [
          { betThisRound: 0, hand: ["AS", "4D", "5C", "7H", "8S"] },
          { betThisRound: 20, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-Q-304 pair-heavy final hands never call facing bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "AH", "3C", "5H", "7S"],
        currentBet: 20,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-Q-305 straight and flush are still not penalized in A-5", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        hand: ["2S", "3S", "4S", "5S", "6S"],
      }),
      legalActions: [{ type: "DRAW", minDiscard: 0, maxDiscard: 5 }],
    });
    expect(result.discardIndexes).toEqual([]);
  });

  it("PRO-S02-R-001 premiumSDA5 pre-draw first in bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "2D", "3C", "4H", "6S"],
        players: [{}, {}, {}, {}],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-V-001 strongSDA5 safe pressure does not fold", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "4C", "5H", "7S"] },
          { betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(["CALL", "RAISE"]).toContain(result.type);
  });

  it("PRO-S02-V-002 strongSDA5 may raise heads-up small pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "4C", "5H", "7S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "4C", "5H", "7S"] },
          { betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["CALL", "RAISE", "FOLD"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-S02-V-003 strongSDA5 avoids 4way large pressure over-raise", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "3D", "4C", "5H", "7S"],
        currentBet: 40,
        betThisRound: 0,
        pots: [{ amount: 60 }],
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "4C", "5H", "7S"] },
          { betThisRound: 40, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-V-004 weak and trash guard remains active", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "AH", "9C", "TD", "QS"],
        currentBet: 10,
        betThisRound: 0,
        players: [
          { betThisRound: 0, hand: ["AS", "AH", "9C", "TD", "QS"] },
          { betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
      candidateAction: { type: "CALL", source: "standard-rule" },
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-V-005 frequency remains disabled", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 1,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "4C", "5H", "7S"] },
          { betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["CALL", "RAISE", "FOLD"],
    });
    expect(result.reason).not.toMatch(/^frequency-/);
  });

  it("PRO-S02-R-002 premiumSDA5 multiway small pressure may raise", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "2D", "3C", "4H", "6S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "3C", "4H", "6S"] },
          { betThisRound: 10, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-S02-R-003 premiumSDA5 does not over-raise large pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "2D", "3C", "4H", "6S"],
        currentBet: 120,
        betThisRound: 0,
        pots: [{ amount: 80 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "3C", "4H", "6S"] },
          { betThisRound: 120, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-R-004 premiumSDA5 bypasses weak/trash guard", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "2D", "3C", "4H", "6S"],
        currentBet: 20,
        betThisRound: 0,
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "3C", "4H", "6S"] },
          { betThisRound: 20, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
      candidateAction: { type: "CALL", source: "standard-rule" },
    });
    expect(["CALL", "RAISE"]).toContain(result.type);
  });

  it("PRO-S02-R-101 strongSDA5 4way first in bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        players: [{}, {}, {}, {}],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-R-102 strongSDA5 4way small pressure calls", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "4C", "5H", "7S"] },
          { betThisRound: 10, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("CALL");
  });

  it("PRO-S02-R-103 strongSDA5 heads-up small pressure may thin raise", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "4C", "5H", "7S"] },
          { betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["CALL", "RAISE"],
    });
    expect(result.type).toBe("RAISE");
  });

  it("PRO-S02-R-104 strongSDA5 avoids raises under large pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "2D", "4C", "5H", "7S"],
        currentBet: 120,
        betThisRound: 0,
        pots: [{ amount: 80 }],
        players: [
          { betThisRound: 0, hand: ["AS", "2D", "4C", "5H", "7S"] },
          { betThisRound: 120, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).not.toBe("RAISE");
  });

  it("PRO-S02-R-201 upperMediumSDA5 heads-up first in may bet", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        players: [{}, {}],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-R-202 upperMediumSDA5 3way first in may bet", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        players: [{}, {}, {}],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("BET");
  });

  it("PRO-S02-R-203 upperMediumSDA5 4way first in checks", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        players: [{}, {}, {}, {}],
      }),
      legalActions: ["BET", "CHECK"],
    });
    expect(result.type).toBe("CHECK");
  });

  it("PRO-S02-R-204 upperMediumSDA5 never raises", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        currentBet: 10,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "5C", "6H", "8S"] },
          { betThisRound: 10, hand: ["KC"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).not.toBe("RAISE");
  });

  it("PRO-S02-R-205 upperMediumSDA5 folds medium or large pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "3D", "5C", "6H", "8S"],
        currentBet: 30,
        betThisRound: 0,
        pots: [{ amount: 100 }],
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "5C", "6H", "8S"] },
          { betThisRound: 30, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL", "RAISE"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-R-301 trashSDA5 still blocks standard CALL", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "AH", "9C", "TD", "QS"],
        currentBet: 20,
        betThisRound: 0,
        players: [
          { betThisRound: 0, hand: ["AS", "AH", "9C", "TD", "QS"] },
          { betThisRound: 20, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
      candidateAction: { type: "CALL", source: "standard-rule" },
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-R-302 weakSDA5 still blocks candidate CALL", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "3D", "6C", "9H", "TS"],
        currentBet: 20,
        betThisRound: 0,
        players: [
          { betThisRound: 0, hand: ["AS", "3D", "6C", "9H", "TS"] },
          { betThisRound: 20, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
      candidateAction: { type: "CALL", source: "onnx" },
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-R-303 lowerMediumSDA5 still folds multiway pressure", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "4D", "5C", "7H", "8S"],
        currentBet: 20,
        betThisRound: 0,
        players: [
          { betThisRound: 0, hand: ["AS", "4D", "5C", "7H", "8S"] },
          { betThisRound: 20, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-R-304 pair-heavy still folds facing bets", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "AH", "3C", "5H", "7S"],
        currentBet: 20,
        betThisRound: 0,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(result.type).toBe("FOLD");
  });

  it("PRO-S02-R-305 fallback remains zero in S02 guarded smoke spots", () => {
    const result = chooseProAction({
      variantId: "S02",
      snapshot: buildSnapshot({
        variantId: "S02",
        street: "BET",
        drawRoundIndex: 0,
        hand: ["AS", "AH", "3C", "5H", "7S"],
        currentBet: 20,
        betThisRound: 0,
        players: [
          { betThisRound: 0, hand: ["AS", "AH", "3C", "5H", "7S"] },
          { betThisRound: 20, hand: ["KC"] },
          { betThisRound: 0, hand: ["QD"] },
          { betThisRound: 0, hand: ["JD"] },
        ],
      }),
      legalActions: ["FOLD", "CALL"],
      candidateAction: { type: "CALL", source: "standard-rule" },
    });
    expect(result.source).toBe("pro-overlay");
    expect(result.type).toBe("FOLD");
  });

  it("PRO-D02-G-001 D02 weakA5 and trashA5 facing-bet calls remain blocked", () => {
    const weak = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AS", "4D", "6C", "8H", "9S"],
        currentBet: 10,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    const trash = chooseProAction({
      variantId: "D02",
      snapshot: buildSnapshot({
        variantId: "D02",
        street: "BET",
        drawRoundIndex: 2,
        hand: ["AS", "AH", "QC", "9H", "7S"],
        currentBet: 10,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(weak.type).toBe("FOLD");
    expect(trash.type).toBe("FOLD");
  });

  it("PRO-D01-G-001 D01 rough 8/9 defense remains constrained", () => {
    const roughEight = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3D", "6C", "7H", "8S"],
        currentBet: 40,
        pots: [{ amount: 60 }],
      }),
      legalActions: ["FOLD", "CALL"],
    });
    const nineLow = chooseProAction({
      variantId: "D01",
      snapshot: buildSnapshot({
        variantId: "D01",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["2S", "3D", "4C", "7H", "9S"],
        currentBet: 10,
      }),
      legalActions: ["FOLD", "CALL"],
    });
    expect(roughEight.type).toBe("FOLD");
    expect(nineLow.type).toBe("FOLD");
  });

  it("PRO-D03-G-001 Badugi fallback remains covered", () => {
    const result = chooseProAction({
      variantId: "D03",
      snapshot: buildSnapshot({
        variantId: "D03",
        street: "BET",
        drawRoundIndex: 3,
        hand: ["AS", "AD", "KC", "KS"],
      }),
      legalActions: ["CHECK", "CALL"],
      candidateAction: { type: "RAISE", source: "onnx" },
    });
    expect(["CHECK", "CALL"]).toContain(result.type);
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
    expect([null, "RAISE", "CALL"]).toContain(result.blockedAction);
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
