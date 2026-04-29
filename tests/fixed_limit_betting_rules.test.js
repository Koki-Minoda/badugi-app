import { describe, expect, it } from "vitest";
import { isBetRoundComplete } from "../src/games/badugi/flow/betRoundUtils.js";
import { BadugiEngine } from "../src/games/badugi/engine/BadugiEngine.js";
import { getFixedLimitBetSize, getFixedLimitRaiseCap } from "../src/games/badugi/logic/bettingRules.js";

function seat(overrides = {}) {
  return {
    name: overrides.name ?? "Seat",
    stack: overrides.stack ?? 200,
    betThisRound: overrides.betThisRound ?? 0,
    totalInvested: overrides.totalInvested ?? 0,
    folded: overrides.folded ?? false,
    hasFolded: overrides.hasFolded ?? false,
    seatOut: overrides.seatOut ?? false,
    allIn: overrides.allIn ?? false,
    hasActedThisRound: overrides.hasActedThisRound ?? false,
    lastAction: overrides.lastAction ?? "",
    hand: overrides.hand ?? ["KD", "QS", "9C", "8H"],
  };
}

function baseState(overrides = {}) {
  return {
    gameId: "badugi",
    engineId: "badugi",
    smallBlind: 10,
    bigBlind: 20,
    players: [
      seat({ name: "Hero", betThisRound: 0, stack: 200 }),
      seat({ name: "Villain", betThisRound: 20, stack: 200, hasActedThisRound: true, totalInvested: 20 }),
    ],
    pots: [],
    metadata: {
      raiseCountThisRound: 0,
      raiseCap: null,
      ...(overrides.metadata ?? {}),
    },
    ...(overrides ?? {}),
  };
}

describe("fixed-limit betting constraints (engine source of truth)", () => {
  it("FL-1 enforces fixed-limit unit alignment for raises", () => {
    const engine = new BadugiEngine();
    const unit = getFixedLimitBetSize({ baseBet: 20, drawRound: 0, betRound: 0 });
    expect(unit).toBe(20);

    const state = baseState();
    expect(() =>
      engine.applyPlayerAction(state, {
        seatIndex: 0,
        type: "RAISE",
        metadata: { amount: 55 },
      }),
    ).toThrow();

    expect(() =>
      engine.applyPlayerAction(state, {
        seatIndex: 0,
        type: "RAISE",
        metadata: { amount: 40 },
      }),
    ).not.toThrow();
  });

  it("FL-2 uses table-configured raise cap and ignores payload cap/count", () => {
    const engine = new BadugiEngine();
    const cappedState = baseState({
      metadata: {
        raiseCap: 1,
        raiseCountThisRound: 1,
      },
    });

    expect(() =>
      engine.applyPlayerAction(cappedState, {
        seatIndex: 0,
        type: "RAISE",
        metadata: {
          amount: 40,
          raiseCap: 99,
          raiseCountThisRound: 0,
        },
      }),
    ).toThrow();

    const unlimitedByDefault = baseState({
      metadata: {
        raiseCap: getFixedLimitRaiseCap(undefined),
        raiseCountThisRound: 8,
      },
    });
    expect(unlimitedByDefault.metadata.raiseCap).toBe(null);
    expect(() =>
      engine.applyPlayerAction(unlimitedByDefault, {
        seatIndex: 0,
        type: "RAISE",
        metadata: { amount: 40 },
      }),
    ).not.toThrow();
  });

  it("FL-3 allows check only when to-call is zero", () => {
    const engine = new BadugiEngine();
    expect(() => engine.applyPlayerAction(baseState(), { seatIndex: 0, type: "CHECK" })).toThrow();
  });

  it("FL-4 requires call amount to match to-call exactly", () => {
    const engine = new BadugiEngine();
    const state = baseState();

    expect(() =>
      engine.applyPlayerAction(state, {
        seatIndex: 0,
        type: "CALL",
        metadata: { amount: 10 },
      }),
    ).toThrow();

    const next = engine.applyPlayerAction(state, {
      seatIndex: 0,
      type: "CALL",
      metadata: { amount: 20 },
    });
    expect(next.players[0].betThisRound).toBe(20);
    expect(next.players[0].totalInvested).toBe(20);
  });

  it("tracks totalInvested as engine truth on each action application", () => {
    const engine = new BadugiEngine();
    let state = baseState();

    state = engine.applyPlayerAction(state, {
      seatIndex: 0,
      type: "CALL",
      metadata: { amount: 20 },
    });
    expect(state.players[0].totalInvested).toBe(20);

    state = engine.applyPlayerAction(state, {
      seatIndex: 1,
      type: "RAISE",
      metadata: { amount: 20 },
    });
    expect(state.players[1].totalInvested).toBe(40);
  });

  it("FL-5 round-complete checks require matched bets or full checks", () => {
    const matched = [
      seat({ name: "P1", betThisRound: 20, hasActedThisRound: true }),
      seat({ name: "P2", betThisRound: 20, hasActedThisRound: true }),
      seat({ name: "P3", betThisRound: 20, hasActedThisRound: true }),
    ];
    expect(isBetRoundComplete(matched)).toBe(true);

    const allChecked = [
      seat({ name: "P1", betThisRound: 0, hasActedThisRound: true, lastAction: "Check" }),
      seat({ name: "P2", betThisRound: 0, hasActedThisRound: true, lastAction: "Check" }),
    ];
    expect(isBetRoundComplete(allChecked)).toBe(true);

    const notMatched = [
      seat({ name: "P1", betThisRound: 20, hasActedThisRound: true }),
      seat({ name: "P2", betThisRound: 10, hasActedThisRound: true }),
    ];
    expect(isBetRoundComplete(notMatched)).toBe(false);
  });

  it("FL-6 showdown conserves chips and matches invested/payout formulas", () => {
    const engine = new BadugiEngine();
    const startStacks = [340, 420, 360, 480, 340, 340];
    const invested = [100, 100, 100, 100, 100, 100];

    const players = [
      seat({ name: "You", stack: 240, totalInvested: invested[0], hand: ["7C", "4H", "5S", "8D"] }),
      seat({ name: "CPU 2", stack: 320, totalInvested: invested[1], hand: ["5H", "3D", "3C", "JD"] }),
      seat({ name: "CPU 3", stack: 260, totalInvested: invested[2], hand: ["3H", "7D", "5D", "10H"] }),
      seat({ name: "CPU 4", stack: 380, totalInvested: invested[3], hand: ["AD", "7H", "JH", "10S"] }),
      seat({ name: "CPU 5", stack: 240, totalInvested: invested[4], hand: ["2D", "AH", "5C", "9S"] }),
      seat({ name: "CPU 6", stack: 240, totalInvested: invested[5], hand: ["KD", "10D", "8S", "QC"] }),
    ];

    const showdown = engine.resolveShowdown(
      {
        gameId: "badugi",
        engineId: "badugi",
        players,
        pots: [],
        metadata: {},
      },
      { cloneState: true },
    );

    const potFromInvested = invested.reduce((sum, value) => sum + value, 0);
    const payoutBySeat = new Map();
    const totalPayout = (showdown.summary ?? []).reduce((sum, potSummary) => {
      return (
        sum +
        (potSummary?.payouts ?? []).reduce((inner, entry) => {
          const seatIndex = entry?.seatIndex;
          const payout = Math.max(0, Number(entry?.payout) || 0);
          if (typeof seatIndex === "number") {
            payoutBySeat.set(seatIndex, (payoutBySeat.get(seatIndex) ?? 0) + payout);
          }
          return inner + payout;
        }, 0)
      );
    }, 0);

    expect(showdown.totalPot).toBe(potFromInvested);
    expect(totalPayout).toBe(potFromInvested);

    const finalStacks = showdown.state.players.map((player) => player.stack);
    finalStacks.forEach((finalStack, seatIndex) => {
      const expected = startStacks[seatIndex] - invested[seatIndex] + (payoutBySeat.get(seatIndex) ?? 0);
      expect(finalStack).toBe(expected);
    });
  });
});
