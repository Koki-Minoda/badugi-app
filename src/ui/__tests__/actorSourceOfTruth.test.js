// src/ui/__tests__/actorSourceOfTruth.test.js
//
// Unit tests for src/ui/utils/actorSourceOfTruth.js
//
// Coverage:
//   resolveActorFromSnapshot      – full 6-field priority chain + null sentinel
//   isSeatActionEligibleForPhase  – phase gate, folded/busted/seatOut,
//                                   all-in, hasDrawn, stack=0
//   resolveCanonicalActionSeat    – prefers controllerTurn; falls back
//   resolveSessionPreferredActor  – getSnapshot() path + graceful fallbacks
//   shouldSyncLegacyTurnToController

import { describe, expect, it, vi } from "vitest";
import {
  isSeatActionEligibleForPhase,
  resolveActorFromSnapshot,
  resolveCanonicalActionSeat,
  resolveSessionPreferredActor,
  shouldSyncLegacyTurnToController,
} from "../utils/actorSourceOfTruth.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides = {}) {
  return {
    stack: 500,
    folded: false,
    hasFolded: false,
    seatOut: false,
    isBusted: false,
    busted: false,
    allIn: false,
    hasDrawn: false,
    ...overrides,
  };
}

function makePlayers(count = 3, overrides = {}) {
  return Array.from({ length: count }, (_, i) =>
    makePlayer({ seatIndex: i, ...overrides }),
  );
}

// ---------------------------------------------------------------------------
// resolveActorFromSnapshot – priority chain
// ---------------------------------------------------------------------------

describe("resolveActorFromSnapshot – priority chain", () => {
  it("1. returns currentActor when present", () => {
    expect(
      resolveActorFromSnapshot({ currentActor: 2, actingPlayerIndex: 5, nextTurn: 4 }),
    ).toBe(2);
  });

  it("1b. returns 0 for currentActor=0 (falsy must not be skipped)", () => {
    expect(resolveActorFromSnapshot({ currentActor: 0, actingPlayerIndex: 3 })).toBe(0);
  });

  it("2. falls back to actingPlayerIndex when currentActor absent", () => {
    expect(
      resolveActorFromSnapshot({ actingPlayerIndex: 3, turnSeat: 5, nextTurn: 1 }),
    ).toBe(3);
  });

  it("2b. actingPlayerIndex=0 is not skipped", () => {
    expect(resolveActorFromSnapshot({ actingPlayerIndex: 0, nextTurn: 4 })).toBe(0);
  });

  it("3. falls back to turnSeat when currentActor and actingPlayerIndex absent", () => {
    expect(resolveActorFromSnapshot({ turnSeat: 1, turn: 4, nextTurn: 5 })).toBe(1);
  });

  it("3b. falls back to turn when currentActor, actingPlayerIndex, turnSeat absent", () => {
    expect(resolveActorFromSnapshot({ turn: 4, nextTurn: 5 })).toBe(4);
  });

  it("3c. falls back to nextTurn when all higher-priority fields absent", () => {
    expect(resolveActorFromSnapshot({ nextTurn: 2 })).toBe(2);
  });

  it("4. falls back to metadata.actingPlayerIndex as last resort", () => {
    expect(resolveActorFromSnapshot({ metadata: { actingPlayerIndex: 4 } })).toBe(4);
  });

  it("4b. metadata.actingPlayerIndex=0 is not skipped", () => {
    expect(resolveActorFromSnapshot({ metadata: { actingPlayerIndex: 0 } })).toBe(0);
  });

  it("5. returns null when no actor fields are present", () => {
    expect(resolveActorFromSnapshot({})).toBeNull();
  });

  it("5b. returns null for null input", () => {
    expect(resolveActorFromSnapshot(null)).toBeNull();
  });

  it("5b2. returns null for undefined input", () => {
    expect(resolveActorFromSnapshot(undefined)).toBeNull();
  });

  it("5c. returns null for string actor fields (not typeof number)", () => {
    expect(resolveActorFromSnapshot({ currentActor: "2", nextTurn: "1" })).toBeNull();
  });

  it("5d. returns null when metadata exists but actingPlayerIndex is absent", () => {
    expect(resolveActorFromSnapshot({ metadata: { currentBet: 20 } })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isSeatActionEligibleForPhase – phase gate
// ---------------------------------------------------------------------------

describe("isSeatActionEligibleForPhase – non-action phases always return false", () => {
  it("6e. returns false for SHOWDOWN phase", () => {
    expect(isSeatActionEligibleForPhase(makePlayers(3), 0, "SHOWDOWN")).toBe(false);
  });

  it("returns false for COLLECT phase", () => {
    expect(isSeatActionEligibleForPhase(makePlayers(3), 0, "COLLECT")).toBe(false);
  });

  it("returns false for RESULT phase", () => {
    expect(isSeatActionEligibleForPhase(makePlayers(3), 0, "RESULT")).toBe(false);
  });

  it("returns false for null phase", () => {
    expect(isSeatActionEligibleForPhase(makePlayers(3), 0, null)).toBe(false);
  });

  it("returns false for undefined phase", () => {
    expect(isSeatActionEligibleForPhase(makePlayers(3), 0, undefined)).toBe(false);
  });

  it("accepts lowercase phase names (normalised internally)", () => {
    expect(isSeatActionEligibleForPhase(makePlayers(3), 0, "bet")).toBe(true);
    expect(isSeatActionEligibleForPhase(makePlayers(3), 0, "draw")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isSeatActionEligibleForPhase – seat bounds
// ---------------------------------------------------------------------------

describe("isSeatActionEligibleForPhase – seat bounds", () => {
  it("returns false for out-of-bounds seat index", () => {
    expect(isSeatActionEligibleForPhase(makePlayers(3), 5, "BET")).toBe(false);
  });

  it("returns false for negative seat index", () => {
    expect(isSeatActionEligibleForPhase(makePlayers(3), -1, "BET")).toBe(false);
  });

  it("returns false for NaN seat", () => {
    expect(isSeatActionEligibleForPhase(makePlayers(3), NaN, "BET")).toBe(false);
  });

  it("returns false when players is not an array", () => {
    expect(isSeatActionEligibleForPhase(null, 0, "BET")).toBe(false);
    expect(isSeatActionEligibleForPhase(undefined, 0, "BET")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSeatActionEligibleForPhase – folded / busted / seatOut (universal)
// ---------------------------------------------------------------------------

describe("isSeatActionEligibleForPhase – folded/busted/seatOut disqualify in all action phases", () => {
  it("5a. returns false for folded player in BET", () => {
    const players = makePlayers(3);
    players[1] = makePlayer({ folded: true });
    expect(isSeatActionEligibleForPhase(players, 1, "BET")).toBe(false);
  });

  it("5b. returns false for hasFolded player in DRAW", () => {
    const players = makePlayers(3);
    players[1] = makePlayer({ hasFolded: true });
    expect(isSeatActionEligibleForPhase(players, 1, "DRAW")).toBe(false);
  });

  it("5c. returns false for seatOut player in BET", () => {
    const players = makePlayers(3);
    players[0] = makePlayer({ seatOut: true });
    expect(isSeatActionEligibleForPhase(players, 0, "BET")).toBe(false);
  });

  it("5d. returns false for isBusted player in DRAW", () => {
    const players = makePlayers(3);
    players[2] = makePlayer({ isBusted: true });
    expect(isSeatActionEligibleForPhase(players, 2, "DRAW")).toBe(false);
  });

  it("returns false for busted player in DRAW", () => {
    const players = makePlayers(3);
    players[0] = makePlayer({ busted: true });
    expect(isSeatActionEligibleForPhase(players, 0, "DRAW")).toBe(false);
  });

  it("folded all-in player is still excluded from DRAW (fold beats all-in rule)", () => {
    const players = makePlayers(3);
    players[1] = makePlayer({ folded: true, allIn: true, stack: 0, hasDrawn: false });
    expect(isSeatActionEligibleForPhase(players, 1, "DRAW")).toBe(false);
  });

  it.each([
    ["folded", { folded: true }],
    ["hasFolded", { hasFolded: true }],
    ["seatOut", { seatOut: true }],
    ["isBusted", { isBusted: true }],
    ["busted", { busted: true }],
  ])("returns false for %s players in both BET and DRAW", (_label, overrides) => {
    const players = makePlayers(3);
    players[1] = makePlayer(overrides);

    expect(isSeatActionEligibleForPhase(players, 1, "BET")).toBe(false);
    expect(isSeatActionEligibleForPhase(players, 1, "DRAW")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSeatActionEligibleForPhase – BET: all-in and stack=0 excluded (test 6)
// ---------------------------------------------------------------------------

describe("isSeatActionEligibleForPhase – BET excludes all-in and stack=0", () => {
  it("6. returns false for all-in seat in BET", () => {
    const players = makePlayers(3);
    players[1] = makePlayer({ allIn: true, stack: 0 });
    expect(isSeatActionEligibleForPhase(players, 1, "BET")).toBe(false);
  });

  it("returns false for stack=0 seat in BET even when allIn flag is absent", () => {
    const players = makePlayers(3);
    players[0] = makePlayer({ allIn: false, stack: 0 });
    expect(isSeatActionEligibleForPhase(players, 0, "BET")).toBe(false);
  });

  it("returns true for normal seat with stack>0 in BET", () => {
    const players = makePlayers(3);
    players[0] = makePlayer({ allIn: false, stack: 200 });
    expect(isSeatActionEligibleForPhase(players, 0, "BET")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isSeatActionEligibleForPhase – DRAW: TDA-style all-in inclusion (tests 7-8)
//
// TDA rule: all-in players and stack=0 players may still make pat/draw
// decisions.  They are excluded only if already drawn (hasDrawn=true) or
// if folded/busted/seatOut (universal exclusions above).
// ---------------------------------------------------------------------------

describe("isSeatActionEligibleForPhase – DRAW TDA-style all-in inclusion (tests 7-8)", () => {
  it("7. returns true for all-in seat in DRAW when hasDrawn=false", () => {
    const players = makePlayers(3);
    players[1] = makePlayer({ allIn: true, stack: 0, hasDrawn: false });
    expect(isSeatActionEligibleForPhase(players, 1, "DRAW")).toBe(true);
  });

  it("7b. returns true for all-in seat with stack>0 in DRAW when hasDrawn=false", () => {
    // Edge: all-in flag set but stack is non-zero (partial all-in scenario)
    const players = makePlayers(3);
    players[2] = makePlayer({ allIn: true, stack: 50, hasDrawn: false });
    expect(isSeatActionEligibleForPhase(players, 2, "DRAW")).toBe(true);
  });

  it("8. returns false for all-in seat in DRAW when hasDrawn=true", () => {
    const players = makePlayers(3);
    players[1] = makePlayer({ allIn: true, stack: 0, hasDrawn: true });
    expect(isSeatActionEligibleForPhase(players, 1, "DRAW")).toBe(false);
  });

  it("4+. stack=0 alone does not disqualify from DRAW when hasDrawn=false", () => {
    // A player busted to 0 chips in a previous round but is still active
    // for draw decisions this round.
    const players = makePlayers(3);
    players[0] = makePlayer({ allIn: false, stack: 0, hasDrawn: false });
    expect(isSeatActionEligibleForPhase(players, 0, "DRAW")).toBe(true);
  });

  it("stack=0 disqualifies from DRAW when hasDrawn=true", () => {
    const players = makePlayers(3);
    players[0] = makePlayer({ allIn: false, stack: 0, hasDrawn: true });
    expect(isSeatActionEligibleForPhase(players, 0, "DRAW")).toBe(false);
  });

  it("normal seat (non-all-in, stack>0) is eligible in DRAW when hasDrawn=false", () => {
    const players = makePlayers(3);
    players[1] = makePlayer({ allIn: false, stack: 400, hasDrawn: false });
    expect(isSeatActionEligibleForPhase(players, 1, "DRAW")).toBe(true);
  });

  it("normal seat is ineligible in DRAW when hasDrawn=true", () => {
    const players = makePlayers(3);
    players[1] = makePlayer({ allIn: false, stack: 400, hasDrawn: true });
    expect(isSeatActionEligibleForPhase(players, 1, "DRAW")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveCanonicalActionSeat
// ---------------------------------------------------------------------------

describe("resolveCanonicalActionSeat", () => {
  it("returns controllerTurn when it is eligible in BET", () => {
    const players = makePlayers(4);
    expect(
      resolveCanonicalActionSeat({ phase: "BET", controllerTurn: 2, legacyTurn: 3, players }),
    ).toBe(2);
  });

  it("returns controllerTurn for all-in seat in DRAW (TDA rule)", () => {
    const players = makePlayers(4);
    players[1] = makePlayer({ allIn: true, stack: 0, hasDrawn: false });
    expect(
      resolveCanonicalActionSeat({ phase: "DRAW", controllerTurn: 1, legacyTurn: 3, players }),
    ).toBe(1);
  });

  it("falls back to legacyTurn when controllerTurn seat is folded", () => {
    const players = makePlayers(4);
    players[2] = makePlayer({ folded: true });
    expect(
      resolveCanonicalActionSeat({ phase: "BET", controllerTurn: 2, legacyTurn: 3, players }),
    ).toBe(3);
  });

  it("falls back to legacyTurn when controllerTurn is all-in in BET", () => {
    const players = makePlayers(4);
    players[2] = makePlayer({ allIn: true, stack: 0 });
    expect(
      resolveCanonicalActionSeat({ phase: "BET", controllerTurn: 2, legacyTurn: 3, players }),
    ).toBe(3);
  });

  it("returns null when both seats are ineligible", () => {
    const players = makePlayers(2);
    players[0] = makePlayer({ folded: true });
    players[1] = makePlayer({ folded: true });
    expect(
      resolveCanonicalActionSeat({ phase: "BET", controllerTurn: 0, legacyTurn: 1, players }),
    ).toBeNull();
  });

  it("returns null for SHOWDOWN phase (not an action phase)", () => {
    const players = makePlayers(3);
    expect(
      resolveCanonicalActionSeat({ phase: "SHOWDOWN", controllerTurn: 0, legacyTurn: 1, players }),
    ).toBeNull();
  });

  it("returns null when both turns are undefined", () => {
    const players = makePlayers(3);
    expect(
      resolveCanonicalActionSeat({ phase: "BET", controllerTurn: undefined, legacyTurn: undefined, players }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// shouldSyncLegacyTurnToController
// ---------------------------------------------------------------------------

describe("shouldSyncLegacyTurnToController", () => {
  it("returns true when controllerTurn is eligible in BET and differs from legacyTurn", () => {
    const players = makePlayers(4);
    expect(
      shouldSyncLegacyTurnToController({ phase: "BET", controllerTurn: 2, legacyTurn: 3, players }),
    ).toBe(true);
  });

  it("returns true when controllerTurn is all-in in DRAW and differs from legacyTurn", () => {
    const players = makePlayers(4);
    players[2] = makePlayer({ allIn: true, stack: 0, hasDrawn: false });
    expect(
      shouldSyncLegacyTurnToController({ phase: "DRAW", controllerTurn: 2, legacyTurn: 3, players }),
    ).toBe(true);
  });

  it("returns false when controllerTurn equals legacyTurn (already in sync)", () => {
    const players = makePlayers(4);
    expect(
      shouldSyncLegacyTurnToController({ phase: "BET", controllerTurn: 2, legacyTurn: 2, players }),
    ).toBe(false);
  });

  it("returns false when controllerTurn seat is folded in BET", () => {
    const players = makePlayers(4);
    players[2] = makePlayer({ folded: true });
    expect(
      shouldSyncLegacyTurnToController({ phase: "BET", controllerTurn: 2, legacyTurn: 3, players }),
    ).toBe(false);
  });

  it("returns false for SHOWDOWN phase regardless of turns", () => {
    const players = makePlayers(4);
    expect(
      shouldSyncLegacyTurnToController({ phase: "SHOWDOWN", controllerTurn: 1, legacyTurn: 2, players }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveSessionPreferredActor
// ---------------------------------------------------------------------------

describe("resolveSessionPreferredActor", () => {
  it("returns actor from gameController.getSnapshot() when preferSession=false", () => {
    const gameController = { getSnapshot: () => ({ currentActor: 3 }) };
    expect(resolveSessionPreferredActor({ gameController })).toBe(3);
  });

  it("returns actor from sessionController.getUiSnapshot() when preferSession=true", () => {
    const sessionController = { getUiSnapshot: () => ({ currentActor: 1 }) };
    const gameController = { getSnapshot: () => ({ currentActor: 5 }) };
    expect(
      resolveSessionPreferredActor({
        sessionController,
        sessionState: {},
        gameController,
        preferSession: true,
      }),
    ).toBe(1);
  });

  it("falls back to sessionState actor fields when getUiSnapshot throws", () => {
    const sessionController = {
      getUiSnapshot: () => { throw new Error("snapshot error"); },
    };
    const warnSpy = vi.fn();
    expect(
      resolveSessionPreferredActor({
        sessionController,
        sessionState: { nextTurn: 4 },
        preferSession: true,
        warn: warnSpy,
      }),
    ).toBe(4);
    expect(warnSpy).toHaveBeenCalledWith(
      "[CTRL][TURN] unable to read session controller turn",
      expect.any(Error),
    );
  });

  it("returns null when gameController has no getSnapshot method (soft-contract gap C-03)", () => {
    // A draw or stud controller that does not define getSnapshot silently
    // returns null; the caller must fall back to legacyTurn.
    const gameController = { someOtherMethod: () => {} };
    expect(resolveSessionPreferredActor({ gameController })).toBeNull();
  });

  it("returns null and calls warn when gameController.getSnapshot throws", () => {
    const warnSpy = vi.fn();
    const gameController = {
      getSnapshot: () => { throw new Error("controller error"); },
    };
    expect(resolveSessionPreferredActor({ gameController, warn: warnSpy })).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      "[CTRL][TURN] unable to read controller turn",
      expect.any(Error),
    );
  });

  it("returns null when called with no arguments", () => {
    expect(resolveSessionPreferredActor()).toBeNull();
  });
});
