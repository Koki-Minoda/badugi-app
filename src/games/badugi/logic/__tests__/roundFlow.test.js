import { describe, it, expect, vi } from "vitest";
import {
  isBetRoundComplete,
  closingSeatForAggressor,
  buildSidePots,
  resetBetRoundFlags,
  analyzeBetSnapshot,
  isSeatEligibleForBet,
  transitionToDrawPhase,
  transitionToShowdownPhase,
  transitionToBetPhase,
  shouldSkipDrawRound,
} from "../../engine/roundFlow.js";
import { findNextActorSeatForPhase } from "../../flow/nextActorUtils.js";

const makePlayer = ({
  folded = false,
  allIn = false,
  betThisRound = 0,
  hasActedThisRound = false,
} = {}) => ({
  folded,
  allIn,
  betThisRound,
  hasActedThisRound,
});

const findNextDrawSeat = (players, startIdx = 0) =>
  findNextActorSeatForPhase({ phase: "DRAW", players, startIdx });

describe("shouldSkipDrawRound", () => {
  const seat = (overrides = {}) => ({
    isSeated: true,
    isActiveInGame: true,
    folded: false,
    allIn: false,
    canDraw: overrides.canDraw ?? true,
    drawRequest: overrides.drawRequest ?? 0,
    ...overrides,
  });

  it("returns false when an eligible player can pat with zero requested cards", () => {
    expect(
      shouldSkipDrawRound({
        players: [seat({ drawRequest: 0 }), seat({ folded: true, drawRequest: 3 })],
      }),
    ).toBe(false);
  });

  it("returns false when at least one eligible player requests a draw", () => {
    expect(
      shouldSkipDrawRound({
        players: [seat({ drawRequest: 0 }), seat({ drawRequest: 2 })],
      }),
    ).toBe(false);
  });

  it("ignores folded or all-in seats even if they request cards", () => {
    expect(
      shouldSkipDrawRound({
        players: [seat({ folded: true, drawRequest: 3 }), seat({ allIn: true, drawRequest: 2 })],
      }),
    ).toBe(true);
  });

  it("respects force flag in metadata", () => {
    expect(
      shouldSkipDrawRound({
        players: [seat({ drawRequest: 0 })],
        meta: { forceDrawRound: true },
      }),
    ).toBe(false);
  });
});

describe("closingSeatForAggressor", () => {
  it("returns aggressor seat when still active", () => {
    const players = [makePlayer(), makePlayer()];
    expect(closingSeatForAggressor(players, 1)).toBe(1);
  });

  it("returns next eligible seat when aggressor is all-in", () => {
    const players = [
      makePlayer({ allIn: true }),
      makePlayer({ folded: false }),
      makePlayer({ folded: false }),
    ];
    expect(closingSeatForAggressor(players, 0)).toBe(1);
  });

  it("returns null when aggressor index is invalid or folded", () => {
    const players = [makePlayer({ folded: true })];
    expect(closingSeatForAggressor(players, null)).toBeNull();
    expect(closingSeatForAggressor(players, 0)).toBeNull();
  });
});

describe("isBetRoundComplete", () => {
  it("returns true when no eligible players remain", () => {
    const players = [
      makePlayer({ folded: true }),
      makePlayer({ allIn: true, hasActedThisRound: true }),
    ];
    expect(isBetRoundComplete(players)).toBe(true);
  });

  it("requires a lone active player to act and match current bet", () => {
    const players = [
      makePlayer({ betThisRound: 0, hasActedThisRound: false }),
      makePlayer({ folded: true }),
    ];
    expect(isBetRoundComplete(players)).toBe(false);

    const resolved = [
      makePlayer({ betThisRound: 0, hasActedThisRound: true }),
      makePlayer({ folded: true }),
    ];
    expect(isBetRoundComplete(resolved)).toBe(true);
  });

  it("returns false when bet sizes mismatch", () => {
    const players = [
      makePlayer({ betThisRound: 20, hasActedThisRound: true }),
      makePlayer({ betThisRound: 10, hasActedThisRound: true }),
      makePlayer({ folded: true }),
    ];
    expect(isBetRoundComplete(players)).toBe(false);
  });

  it("returns false when some active player has not acted yet", () => {
    const players = [
      makePlayer({ betThisRound: 20, hasActedThisRound: true }),
      makePlayer({ betThisRound: 20, hasActedThisRound: false }),
      makePlayer({ allIn: true, hasActedThisRound: true }),
    ];
    expect(isBetRoundComplete(players)).toBe(false);
  });

  it("returns true when all active players matched bet or are all-in and have acted", () => {
    const players = [
      makePlayer({ betThisRound: 20, hasActedThisRound: true }),
      makePlayer({ betThisRound: 20, hasActedThisRound: true }),
      makePlayer({ allIn: true, hasActedThisRound: true }),
      makePlayer({ folded: true }),
    ];
    expect(isBetRoundComplete(players)).toBe(true);
  });

  it("keeps limped big blind pending until they act", () => {
    const players = [
      makePlayer({ betThisRound: 10, hasActedThisRound: true }), // BTN
      makePlayer({ betThisRound: 10, hasActedThisRound: true }), // SB completes
      makePlayer({ betThisRound: 10, hasActedThisRound: false }), // BB hero
      makePlayer({ betThisRound: 10, hasActedThisRound: true }),
      makePlayer({ betThisRound: 10, hasActedThisRound: true }),
      makePlayer({ betThisRound: 10, hasActedThisRound: true }),
    ];
    expect(isBetRoundComplete(players)).toBe(false);

    const resolved = players.map((player, idx) =>
      idx === 2 ? { ...player, hasActedThisRound: true, lastAction: "Check" } : player
    );
    expect(isBetRoundComplete(resolved)).toBe(true);
  });

  it("requires the big blind to respond after a raise", () => {
    const players = [
      makePlayer({ betThisRound: 20, hasActedThisRound: true }), // BTN
      makePlayer({ betThisRound: 20, hasActedThisRound: true }), // SB
      makePlayer({ betThisRound: 10, hasActedThisRound: false }), // BB hero
      makePlayer({ betThisRound: 20, hasActedThisRound: true }), // UTG
      makePlayer({ betThisRound: 20, hasActedThisRound: true }), // MP (raiser)
      makePlayer({ betThisRound: 20, hasActedThisRound: true }), // CO
    ];
    expect(isBetRoundComplete(players)).toBe(false);

    const heroMatched = players.map((player, idx) =>
      idx === 2
        ? {
            ...player,
            betThisRound: 20,
            hasActedThisRound: true,
            lastAction: "Call",
          }
        : player
    );
    expect(isBetRoundComplete(heroMatched)).toBe(true);
  });
});

describe("buildSidePots", () => {
  const basePlayer = (overrides = {}) => ({
    name: overrides.name ?? "Seat",
    totalInvested: overrides.totalInvested ?? 0,
    betThisRound: overrides.betThisRound ?? 0,
    folded: overrides.folded ?? false,
    hasFolded: overrides.hasFolded ?? false,
    seatOut: overrides.seatOut ?? false,
  });

  it("returns single main pot when everyone has equal committed chips", () => {
    const players = [
      basePlayer({ totalInvested: 120 }),
      basePlayer({ totalInvested: 120 }),
      basePlayer({ totalInvested: 120 }),
    ];
    expect(buildSidePots(players)).toEqual([{ amount: 360, eligible: [0, 1, 2] }]);
  });

  it("creates side pot only when higher stacks invest beyond an all-in threshold", () => {
    const players = [
      basePlayer({ totalInvested: 100 }),
      basePlayer({ totalInvested: 300 }),
      basePlayer({ totalInvested: 300 }),
    ];
    expect(buildSidePots(players)).toEqual([
      { amount: 300, eligible: [0, 1, 2] },
      { amount: 400, eligible: [1, 2] },
    ]);
  });

  it("keeps a heads-up side pot separate even when only one player remains eligible", () => {
    const players = [
      basePlayer({ totalInvested: 100 }),
      basePlayer({ totalInvested: 300 }),
      basePlayer({ totalInvested: 300, folded: true, hasFolded: true }),
    ];
    expect(buildSidePots(players)).toEqual([
      { amount: 300, eligible: [0, 1] },
      { amount: 400, eligible: [1] },
    ]);
  });

  it("keeps folded chips in the pot but excludes them from eligibility", () => {
    const players = [
      basePlayer({ totalInvested: 120 }),
      basePlayer({ totalInvested: 120 }),
      basePlayer({ totalInvested: 80, folded: true, hasFolded: true }),
    ];
    expect(buildSidePots(players)).toEqual([{ amount: 320, eligible: [0, 1] }]);
  });

  it("produces a single pot when everyone folds except one player", () => {
    const players = [
      basePlayer({ totalInvested: 150 }),
      basePlayer({ totalInvested: 60, folded: true, hasFolded: true }),
      basePlayer({ totalInvested: 40, folded: true, hasFolded: true }),
    ];
    expect(buildSidePots(players)).toEqual([{ amount: 250, eligible: [0] }]);
  });
});

describe("resetBetRoundFlags", () => {
  it("resets hasActedThisRound for eligible players only", () => {
    const players = [
      {
        name: "Hero",
        folded: false,
        allIn: false,
        hasActedThisRound: true,
      },
      {
        name: "Folded",
        folded: true,
        hasFolded: true,
        hasActedThisRound: true,
      },
      {
        name: "AllIn",
        allIn: true,
        hasActedThisRound: true,
      },
    ];
    const reset = resetBetRoundFlags(players);
    expect(reset[0].hasActedThisRound).toBe(false);
    expect(reset[1]).toBe(players[1]);
    expect(reset[2]).toBe(players[2]);
  });

  it("returns original array when no changes are required", () => {
    const players = [
      makePlayer({ hasActedThisRound: false }),
      makePlayer({ folded: true, hasActedThisRound: true }),
    ];
    const result = resetBetRoundFlags(players);
    expect(result).toBe(players);
  });
});

describe("draw lifecycle integration", () => {
  it("advances draw actors and transitions back to BET", () => {
    const players = [
      {
        name: "Hero",
        folded: false,
        allIn: false,
        hasDrawn: true,
        hasActedThisRound: true,
      },
      ...Array.from({ length: 5 }, (_, idx) => ({
        name: `CPU ${idx + 1}`,
        folded: false,
        allIn: false,
        hasDrawn: false,
        hasActedThisRound: false,
      })),
    ];
    const setPhase = vi.fn();
    const setPlayers = vi.fn();
    const setTurn = vi.fn();
    transitionToDrawPhase({
      players,
      setPlayers,
      setPhase,
      setTurn,
      dealerIdx: 0,
      nextRound: 1,
      NUM_PLAYERS: players.length,
      forceDrawRound: true,
    });
    expect(setPhase).toHaveBeenCalledWith("DRAW");
    expect(setTurn).toHaveBeenCalledWith(1);

    const visited = [];
    let cursor = findNextDrawSeat(players, 0);
    while (typeof cursor === "number") {
      visited.push(cursor);
      players[cursor] = {
        ...players[cursor],
        hasDrawn: true,
        hasActedThisRound: true,
      };
      cursor = findNextDrawSeat(players, cursor + 1);
    }
    expect(visited).toEqual([1, 2, 3, 4, 5]);
    expect(findNextDrawSeat(players, 0)).toBeNull();

    const setTurnBet = vi.fn();
    const setBetHead = vi.fn();
    transitionToBetPhase({
      players,
      setPlayers,
      setPhase,
      setTurn: setTurnBet,
      turnSeat: 0,
      setBetHead,
      betHeadSeat: 0,
    });
    expect(setPhase).toHaveBeenLastCalledWith("BET");
    expect(setTurnBet).toHaveBeenCalledWith(0);
  });
});

describe("analyzeBetSnapshot", () => {
  const basePlayer = (overrides = {}) => ({
    name: overrides.name ?? "Seat",
    folded: overrides.folded ?? false,
    seatOut: overrides.seatOut ?? false,
    allIn: overrides.allIn ?? false,
    betThisRound: overrides.betThisRound ?? 0,
    hasActedThisRound: overrides.hasActedThisRound ?? false,
    lastAction: overrides.lastAction ?? "",
  });

  it("keeps big blind as a candidate when everyone limps", () => {
    const players = [
      basePlayer({ name: "BTN", betThisRound: 10, hasActedThisRound: true, lastAction: "Call" }),
      basePlayer({ name: "SB", betThisRound: 10, hasActedThisRound: true, lastAction: "Call" }),
      basePlayer({ name: "BB Hero", betThisRound: 10 }),
      basePlayer({ name: "UTG", betThisRound: 10, hasActedThisRound: true, lastAction: "Call" }),
      basePlayer({ name: "MP", betThisRound: 10, hasActedThisRound: true, lastAction: "Call" }),
      basePlayer({ name: "CO", betThisRound: 10, hasActedThisRound: true, lastAction: "Call" }),
    ];

    const result = analyzeBetSnapshot({
      players,
      actedIndex: 1,
      dealerIdx: 0,
      drawRound: 0,
      betHead: 2,
      lastAggressorIdx: 2,
    });

    expect(result.maxBet).toBe(10);
    expect(result.nextTurn).toBe(2);
    expect(result.shouldAdvance).toBe(false);
  });

  it("forces the big blind to respond after a raise", () => {
    const players = [
      basePlayer({ name: "BTN", betThisRound: 20, hasActedThisRound: true, lastAction: "Call" }),
      basePlayer({ name: "SB", betThisRound: 20, hasActedThisRound: true, lastAction: "Call" }),
      basePlayer({ name: "BB Hero", betThisRound: 10 }),
      basePlayer({ name: "UTG", betThisRound: 20, hasActedThisRound: true, lastAction: "Call" }),
      basePlayer({ name: "MP", betThisRound: 20, hasActedThisRound: true, lastAction: "Raise" }),
      basePlayer({ name: "CO", betThisRound: 20, hasActedThisRound: true, lastAction: "Call" }),
    ];

    const result = analyzeBetSnapshot({
      players,
      actedIndex: 1,
      dealerIdx: 0,
      drawRound: 0,
      betHead: 4,
      lastAggressorIdx: 4,
    });

    expect(result.maxBet).toBe(20);
    expect(result.nextTurn).toBe(2);
    expect(result.shouldAdvance).toBe(false);
  });

  it("resets preflop BET flags after blinds are paid", () => {
    const players = Array.from({ length: 6 }, (_, idx) =>
      basePlayer({
        name: `Seat${idx}`,
        betThisRound: idx === 1 ? 5 : idx === 2 ? 10 : 0, // SB/BB posted
        hasActedThisRound: true,
      })
    );

    const normalized = resetBetRoundFlags(players);
    normalized.forEach((player) => {
      if (!player.folded && !player.allIn) {
        expect(player.hasActedThisRound).toBe(false);
      }
    });

    const snapshot = analyzeBetSnapshot({
      players: normalized,
      actedIndex: 0,
      dealerIdx: 0,
      drawRound: 0,
      betHead: 3,
      lastAggressorIdx: 3,
    });

    expect(snapshot.shouldAdvance).toBe(false);
    expect(typeof snapshot.nextTurn).toBe("number");
  });

  it("skips folded SB and targets next eligible seat", () => {
    const players = Array.from({ length: 6 }, (_, idx) =>
      basePlayer({
        name: `Seat${idx}`,
        folded: idx === 1,
        hasActedThisRound: idx === 1,
      })
    );

    const snapshot = analyzeBetSnapshot({
      players,
      actedIndex: 1,
      dealerIdx: 0,
      drawRound: 0,
      betHead: 2,
      lastAggressorIdx: 2,
    });

    expect(snapshot.shouldAdvance).toBe(false);
    expect(snapshot.nextTurn).toBe(2);
  });
});

describe("preflop and draw integration snapshots", () => {
  const seat = (overrides = {}) => ({
    name: overrides.name ?? "Seat",
    betThisRound: overrides.betThisRound ?? 0,
    hasActedThisRound: overrides.hasActedThisRound ?? false,
    lastAction: overrides.lastAction ?? null,
    folded: overrides.folded ?? false,
    allIn: overrides.allIn ?? false,
    seatOut: overrides.seatOut ?? false,
  });

  it("normalizes six-max preflop flags after blinds post", () => {
    const players = [
      seat({ name: "BTN" }),
      seat({ name: "SB", betThisRound: 5, hasActedThisRound: true, lastAction: "Post" }),
      seat({ name: "BB", betThisRound: 10, hasActedThisRound: true, lastAction: "Post" }),
      seat({ name: "UTG" }),
      seat({ name: "MP" }),
      seat({ name: "CO" }),
    ];
    const normalized = resetBetRoundFlags(players);
    normalized.forEach((player) => {
      if (isSeatEligibleForBet(player)) {
        expect(player.hasActedThisRound).toBe(false);
      }
    });

    const snapshot = analyzeBetSnapshot({
      players: normalized,
      actedIndex: 2, // treat BB as the most recent actor so UTG is next
      dealerIdx: 0,
      drawRound: 0,
      betHead: 3,
      lastAggressorIdx: 2,
    });

    expect(snapshot.nextTurn).toBe(3); // UTG acts first
    expect(snapshot.maxBet).toBe(10);
    expect(snapshot.shouldAdvance).toBe(false);
  });

  it("hands action to the next live seat after SB folds and finishes when nobody remains", () => {
    const players = [
      seat({ name: "BTN", betThisRound: 10, hasActedThisRound: true, lastAction: "Call" }),
      seat({
        name: "SB",
        betThisRound: 5,
        hasActedThisRound: true,
        folded: true,
        lastAction: "Fold",
      }),
      seat({ name: "BB", betThisRound: 10, hasActedThisRound: false, lastAction: null }),
      seat({ name: "UTG", betThisRound: 10, hasActedThisRound: true, lastAction: "Call" }),
    ];

    const snapshot = analyzeBetSnapshot({
      players,
      actedIndex: 1,
      dealerIdx: 0,
      drawRound: 0,
      betHead: 2,
      lastAggressorIdx: 2,
    });

    expect(snapshot.nextTurn).toBe(2);
    expect(snapshot.shouldAdvance).toBe(false);

    const everyoneFolded = players.map((player) => ({
      ...player,
      hasActedThisRound: true,
      folded: true,
      lastAction: "Fold",
    }));

    const finished = analyzeBetSnapshot({
      players: everyoneFolded,
      actedIndex: 2,
      dealerIdx: 0,
      drawRound: 0,
      betHead: null,
      lastAggressorIdx: 2,
    });

    expect(finished.nextTurn).toBeNull();
    expect(finished.shouldAdvance).toBe(true);
  });

  it("skips folded or all-in seats when a draw round hands control back to betting", () => {
    const drawComplete = [
      seat({ name: "BTN", folded: true, hasActedThisRound: true, lastAction: "Fold" }),
      seat({ name: "SB", allIn: true, hasActedThisRound: true, betThisRound: 30 }),
      seat({ name: "BB", betThisRound: 30, hasActedThisRound: true }),
      seat({ name: "UTG", betThisRound: 30, hasActedThisRound: true }),
    ];

    const reset = resetBetRoundFlags(drawComplete);
    expect(reset[0].hasActedThisRound).toBe(true); // folded stays untouched
    expect(reset[1].hasActedThisRound).toBe(true); // all-in stays untouched
    expect(reset[2].hasActedThisRound).toBe(false);
    expect(reset[3].hasActedThisRound).toBe(false);

    const snapshot = analyzeBetSnapshot({
      players: reset,
      actedIndex: 1,
      dealerIdx: 0,
      drawRound: 1,
      betHead: 3,
      lastAggressorIdx: 3,
    });

    expect(snapshot.nextTurn).toBe(2);
    expect(snapshot.shouldAdvance).toBe(false);
  });
});

describe("findNextActorSeatForPhase (DRAW)", () => {
  const drawSeat = (overrides = {}) => ({
    name: overrides.name ?? "Seat",
    folded: overrides.folded ?? false,
    seatOut: overrides.seatOut ?? false,
    allIn: overrides.allIn ?? false,
    hasDrawn: overrides.hasDrawn ?? false,
    hasActedThisRound: overrides.hasActedThisRound ?? false,
  });

  it("skips folded and all-in seats while searching", () => {
    const players = [
      drawSeat({ name: "BTN", folded: true, hasActedThisRound: true }),
      drawSeat({ name: "SB", allIn: true, hasActedThisRound: true }),
      drawSeat({ name: "BB", hasActedThisRound: true }),
      drawSeat({ name: "UTG" }),
      drawSeat({ name: "MP" }),
    ];

    expect(findNextDrawSeat(players, 0)).toBe(3);
    players[3].hasActedThisRound = true;
    expect(findNextDrawSeat(players, 3)).toBe(4);
  });

  it("returns null when all eligible seats have acted", () => {
    const players = [
      drawSeat({ hasActedThisRound: true }),
      drawSeat({ hasActedThisRound: true }),
      drawSeat({ hasActedThisRound: true }),
    ];

    expect(findNextDrawSeat(players, 0)).toBeNull();
  });
});

describe("phase transition helpers", () => {
  it("transitionToDrawPhase falls back to dealer+1 when no acting index is provided", () => {
    const setPhase = vi.fn();
    const setTurn = vi.fn();
    const setDrawRound = vi.fn();
    transitionToDrawPhase({
      players: [{ name: "BTN" }, { name: "SB" }],
      setPhase,
      setTurn,
      setDrawRound,
      dealerIdx: 0,
      nextRound: 1,
      NUM_PLAYERS: 2,
      forceDrawRound: true,
    });
    expect(setPhase).toHaveBeenCalledWith("DRAW");
    expect(setDrawRound).toHaveBeenCalledWith(1);
    expect(setTurn).toHaveBeenCalledWith(1);
  });

  it("transitionToShowdownPhase calls runShowdown with provided payload", () => {
    const setPhase = vi.fn();
    const setPlayers = vi.fn();
    const setPots = vi.fn();
    const runShowdown = vi.fn();
    const players = [{ name: "Hero" }];
    const pots = [{ amount: 100 }];
    transitionToShowdownPhase({
      players,
      pots,
      setPlayers,
      setPots,
      setPhase,
      runShowdown,
      dealerIdx: 2,
      drawRound: 3,
    });
    expect(setPhase).toHaveBeenCalledWith("SHOWDOWN");
    expect(runShowdown).toHaveBeenCalledWith(
      expect.objectContaining({
        players,
        pots,
        dealerIdx: 2,
        drawRound: 3,
      }),
    );
  });

  it("transitionToBetPhase updates turn and bet head positions", () => {
    const setPlayers = vi.fn();
    const setPhase = vi.fn();
    const setTurn = vi.fn();
    const setBetHead = vi.fn();
    transitionToBetPhase({
      players: [{}, {}],
      setPlayers,
      setPhase,
      setTurn,
      setBetHead,
      turnSeat: 4,
      betHeadSeat: 1,
    });
    expect(setPhase).toHaveBeenCalledWith("BET");
    expect(setTurn).toHaveBeenCalledWith(4);
    expect(setBetHead).toHaveBeenCalledWith(1);
  });
});
