import { describe, expect, it } from "vitest";
import { BadugiEngine } from "../badugi/engine/BadugiEngine.js";
import { validatePreflopState } from "../badugi/utils/deckHelpers.js";
import { IllegalActionError } from "../core/errors.js";

describe("BadugiEngine", () => {
  const engine = new BadugiEngine();
  const seatConfig = ["HUMAN", "CPU", "CPU", "EMPTY", "EMPTY", "EMPTY"];
  const playerSeat = (overrides = {}) => ({
    name: "Seat",
    stack: 100,
    betThisRound: 0,
    totalInvested: 0,
    folded: false,
    allIn: false,
    seatOut: false,
    hasActedThisRound: false,
    hand: ["AS", "2D", "3H", "4C"],
    ...overrides,
  });

  it("deals single-deck hands with one burn card", () => {
    const fullSeats = ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"];
    const state = engine.initHand({
      seatConfig: fullSeats,
      startingStack: 500,
      dealerIndex: 0,
    });
    state.players.forEach((player, idx) => {
      if (fullSeats[idx] === "EMPTY") {
        expect(player.hand).toHaveLength(0);
      } else {
        expect(player.hand).toHaveLength(4);
      }
    });
    const validation = validatePreflopState({
      deck: engine.getDeckManager().deck,
      burn: engine.getDeckManager().burnPile,
      discard: engine.getDeckManager().discardPile,
      players: state.players,
    });
    expect(validation.isValidTotal).toBe(true);
    expect(validation.hasSingleBurn).toBe(true);
    expect(validation.hasEmptyDiscard).toBe(true);
  });

  it("initializes a table with the requested seats", () => {
    const state = engine.initHand({
      seatConfig,
      startingStack: 500,
      dealerIndex: 2,
      heroProfile: { name: "Tester", avatar: "♠" },
      structure: { sb: 5, bb: 10, ante: 1 },
    });

    expect(state.players).toHaveLength(seatConfig.length);
    expect(state.players[0].name).toBe("Tester");
    expect(state.smallBlind).toBe(5);
    expect(state.bigBlind).toBe(10);
    expect(state.ante).toBe(1);
    expect(state.dealerIndex).toBe(2);
  });

  it("records valid actions in metadata", () => {
    const state = engine.initHand({ seatConfig });
    const next = engine.applyPlayerAction(state, { seatIndex: 0, type: "check" });

    expect(next).not.toBe(state);
    expect(next.metadata?.lastAction).toMatchObject({
      seatIndex: 0,
      type: "CHECK",
    });
  });

  it("throws IllegalActionError for invalid seats or actions", () => {
    const state = engine.initHand({ seatConfig });

    expect(() =>
      engine.applyPlayerAction(state, { seatIndex: 99, type: "CALL" })
    ).toThrow(IllegalActionError);

    expect(() =>
      engine.applyPlayerAction(state, { seatIndex: 0, type: "INVALID" })
    ).toThrow(IllegalActionError);

    const foldedState = {
      ...state,
      players: state.players.map((p, i) => (i === 1 ? { ...p, folded: true } : p)),
    };

    expect(() =>
      engine.applyPlayerAction(foldedState, { seatIndex: 1, type: "CALL" })
    ).toThrow(IllegalActionError);
  });

  it("applies antes and blinds, advancing the acting seat", () => {
    const richState = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 100,
      dealerIndex: 0,
      structure: { sb: 5, bb: 10, ante: 1 },
    });

    const forced = engine.applyForcedBets(richState);

    expect(forced.metadata?.forcedBetsApplied).toBe(true);
    // Seat 1 should be SB (ante + SB)
    expect(forced.players[1].betThisRound).toBe(6);
    // Seat 2 should be BB (ante + BB)
    expect(forced.players[2].betThisRound).toBe(11);
    expect(forced.metadata?.currentBet).toBe(11);
    expect(forced.metadata?.totalCommitted).toBe(1 + 6 + 11);
    // Acting player should be seat 0 (UTG, player after BB)
    expect(forced.actingPlayerIndex).toBe(0);
    expect(forced.lastAggressorIndex).toBe(2);
  });

  it("skips seatOut players when searching for blinds", () => {
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 5,
      dealerIndex: 0,
      structure: { sb: 3, bb: 5 },
    });

    const custom = {
      ...state,
      players: state.players.map((p, i) =>
        i === 1 ? { ...p, seatOut: true, stack: 0 } : { ...p, stack: 5 }
      ),
    };

    const forced = engine.applyForcedBets(custom);
    // Seat 1 is seatOut, so the effective heads-up blind rule makes BTN seat 0 the SB.
    expect(forced.players[0].betThisRound).toBe(3);
    expect(forced.players[2].betThisRound).toBe(5);
    expect(forced.lastAggressorIndex).toBe(2);
    expect(forced.actingPlayerIndex).toBeNull();
    expect(forced.metadata?.actingPlayerIndex).toBeNull();
  });

  it("handles CALL actions without metadata by computing toCall internally", () => {
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 100,
      dealerIndex: 0,
      structure: { sb: 5, bb: 10 },
    });
    const forced = engine.applyForcedBets(state);
    const next = engine.applyPlayerAction(forced, { seatIndex: 0, type: "CALL" });

    expect(next.players[0].betThisRound).toBe(10);
    expect(next.players[0].stack).toBe(90);
    expect(next.metadata?.lastAction).toMatchObject({ type: "CALL", seatIndex: 0 });
  });

  it("defaults RAISE sizing to the big blind when metadata is omitted", () => {
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 200,
      dealerIndex: 0,
      structure: { sb: 5, bb: 10 },
    });
    const forced = engine.applyForcedBets(state);
    const next = engine.applyPlayerAction(forced, { seatIndex: 0, type: "RAISE" });

    expect(next.players[0].betThisRound).toBe(20);
    expect(next.players[0].stack).toBe(180);
    expect(next.metadata?.currentBet).toBe(20);
    expect(next.metadata?.betHead).toBe(0);
  });

  it("advances to DRAW when max draws not reached", () => {
    const base = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 100,
      dealerIndex: 0,
    });
    const withBets = {
      ...base,
      players: base.players.map((p, i) => ({
        ...p,
        betThisRound: i === 0 ? 20 : 20,
      })),
      pots: [],
    };

    const outcome = engine.advanceAfterBet(withBets, {
      drawRound: 0,
      maxDraws: 3,
      dealerIndex: 0,
      numPlayers: 3,
    });

    expect(outcome.street).toBe("DRAW");
    expect(outcome.drawRoundIndex).toBe(1);
    expect(outcome.actingPlayerIndex).toBeDefined();
    outcome.players.forEach((p) => {
      expect(p.betThisRound).toBe(0);
    });
  });

  it("marks SHOWDOWN when max draws exceeded", () => {
    const base = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 100,
      dealerIndex: 1,
    });

    const outcome = engine.advanceAfterBet(base, {
      drawRound: 3,
      maxDraws: 3,
      dealerIndex: 1,
      numPlayers: 3,
    });

    expect(outcome.street).toBe("SHOWDOWN");
    expect(outcome.showdown).toBe(true);
    expect(outcome.state.isHandOver).toBe(true);
  });

  it("updates player state on fold and shifts betHead", () => {
    const state = {
      ...engine.initHand({ seatConfig: ["HUMAN", "CPU", "CPU"], startingStack: 100 }),
      metadata: { betHead: 0, currentBet: 0 },
      lastAggressorIndex: 0,
    };

    const next = engine.applyPlayerAction(state, {
      seatIndex: 0,
      type: "FOLD",
      metadata: {
        stackAfter: 95,
        betAfter: 0,
        actionLabel: "Fold",
      },
    });

    expect(next.players[0].folded).toBe(true);
    expect(next.players[0].hasActedThisRound).toBe(true);
    expect(next.metadata.betHead).toBe(1);
    expect(next.lastAggressorIndex).toBe(1);
  });

  it("handles call metadata updates", () => {
    const state = engine.initHand({ seatConfig: ["HUMAN", "CPU", "CPU"], startingStack: 100 });
    const next = engine.applyPlayerAction(state, {
      seatIndex: 0,
      type: "CALL",
      metadata: {
        toCall: 10,
        paid: 10,
        stackAfter: 90,
        betAfter: 10,
        actionLabel: "Call",
      },
    });
    expect(next.players[0].stack).toBe(90);
    expect(next.players[0].betThisRound).toBe(10);
    expect(next.metadata.currentBet).toBeGreaterThanOrEqual(10);
    expect(next.players[0].totalInvested).toBeGreaterThanOrEqual(10);
  });

  it("handles raise metadata updates", () => {
    const state = {
      ...engine.initHand({ seatConfig: ["HUMAN", "CPU", "CPU"], startingStack: 100 }),
      metadata: { betHead: null },
    };
    const next = engine.applyPlayerAction(state, {
      seatIndex: 0,
      type: "RAISE",
      metadata: {
        toCall: 10,
        raise: 20,
        paid: 30,
        stackAfter: 70,
        betAfter: 30,
        actionLabel: "Raise",
      },
    });
    expect(next.players[0].stack).toBe(70);
    expect(next.players[0].betThisRound).toBe(30);
    expect(next.metadata.betHead).toBe(0);
    expect(next.lastAggressorIndex).toBe(0);
    expect(next.metadata.totalCommitted).toBeGreaterThanOrEqual(30);
  });

  it("does not reopen betting when a short stack tries to raise but only covers part of the call", () => {
    const state = {
      ...engine.initHand({ seatConfig: ["HUMAN", "CPU", "CPU"], startingStack: 100 }),
      players: [
        playerSeat({ name: "Hero", stack: 60, betThisRound: 40, hasActedThisRound: true }),
        playerSeat({ name: "Short", stack: 20, betThisRound: 0, hasActedThisRound: false }),
        playerSeat({ name: "Caller", stack: 60, betThisRound: 40, hasActedThisRound: true }),
      ],
      metadata: {
        currentBet: 40,
        betHead: 0,
        raiseCountThisRound: 1,
        raiseCap: 4,
      },
      lastAggressorIndex: 0,
    };

    const next = engine.applyPlayerAction(state, {
      seatIndex: 1,
      type: "RAISE",
      metadata: { amount: 20 },
    });

    expect(next.players[1]).toMatchObject({
      stack: 0,
      betThisRound: 20,
      allIn: true,
      lastAction: "Call",
      hasActedThisRound: true,
    });
    expect(next.metadata.currentBet).toBe(40);
    expect(next.metadata.betHead).toBe(0);
    expect(next.metadata.raiseCountThisRound).toBe(1);
    expect(next.lastAggressorIndex).toBe(0);
    expect(next.players[0].hasActedThisRound).toBe(true);
    expect(next.players[2].hasActedThisRound).toBe(true);
  });

  it("resolves showdown payouts and summary", () => {
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 100,
      dealerIndex: 0,
    });

    const table = {
      ...state,
      players: state.players.map((p, idx) => ({
        ...p,
        holeCards:
          idx === 0
            ? ["AS", "2H", "3D", "4C"]
            : idx === 1
            ? ["5S", "6H", "7D", "8C"]
            : ["KS", "KD", "KH", "KC"],
        hand:
          idx === 0
            ? ["AS", "2H", "3D", "4C"]
            : idx === 1
            ? ["5S", "6H", "7D", "8C"]
            : ["KS", "KD", "KH", "KC"],
        betThisRound: 20,
        folded: false,
      })),
      pots: [{ amount: 60, eligible: [0, 1, 2] }],
    };

    const result = engine.resolveShowdown(table);
    expect(result.totalPot).toBe(60);
    expect(result.summary).toHaveLength(1);
    expect(result.summary[0].payouts).toHaveLength(1);
    expect(result.summary[0].payouts[0]).toMatchObject({
      seatIndex: 0,
      payout: 60,
    });
    expect(result.state.players[0].stack).toBe(160);
  });

  it("distributes side pots to eligible winners only", () => {
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 100,
      dealerIndex: 0,
    });

    const table = {
      ...state,
      players: state.players.map((p, idx) => ({
        ...p,
        holeCards:
          idx === 0
            ? ["AS", "2H", "3D", "4C"]
            : idx === 1
            ? ["5S", "6H", "7D", "8C"]
            : ["KS", "KD", "KH", "QC"],
        hand:
          idx === 0
            ? ["AS", "2H", "3D", "4C"]
            : idx === 1
            ? ["5S", "6H", "7D", "8C"]
            : ["KS", "KD", "KH", "QC"],
        betThisRound: 0,
        folded: false,
      })),
      pots: [
        { amount: 90, eligible: [0, 1, 2] },
        { amount: 40, eligible: [1, 2] },
      ],
    };

    const result = engine.resolveShowdown(table);
    expect(result.summary).toHaveLength(2);
    const [mainPot, sidePot] = result.summary;
    expect(mainPot.potAmount).toBe(90);
    expect(mainPot.payouts[0]).toMatchObject({ seatIndex: 0, payout: 90 });
    expect(sidePot.potAmount).toBe(40);
    expect(sidePot.payouts[0]).toMatchObject({ seatIndex: 1, payout: 40 });
    expect(result.state.players[0].stack).toBe(190);
    expect(result.state.players[1].stack).toBe(140);
  });

  it("does not award a one-eligible side pot to a shorter all-in main-pot winner", () => {
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 300,
      dealerIndex: 0,
    });

    const table = {
      ...state,
      players: state.players.map((p, idx) => ({
        ...p,
        hand:
          idx === 0
            ? ["AS", "2H", "3D", "4C"]
            : idx === 1
            ? ["5S", "6H", "7D", "8C"]
            : ["KS", "KD", "KH", "QC"],
        totalInvested: idx === 0 ? 100 : 300,
        stack: 0,
        allIn: idx !== 2,
        folded: idx === 2,
      })),
      pots: [],
    };

    const result = engine.resolveShowdown(table);
    expect(result.summary).toHaveLength(2);
    expect(result.summary[0]).toMatchObject({
      potAmount: 300,
      payouts: [expect.objectContaining({ seatIndex: 0, payout: 300 })],
    });
    expect(result.summary[1]).toMatchObject({
      potAmount: 400,
      payouts: [expect.objectContaining({ seatIndex: 1, payout: 400 })],
    });
    expect(result.state.players[0].stack).toBe(300);
    expect(result.state.players[1].stack).toBe(400);
  });

  it("awards multiple side pots independently by eligibility", () => {
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU"],
      startingStack: 600,
      dealerIndex: 0,
    });

    const hands = [
      ["QH", "QD", "QC", "QS"], // worst, main pot only
      ["8S", "7H", "6D", "5C"], // eligible through first side, loses to seat 2
      ["AS", "2H", "3D", "4C"], // wins main through second side
      ["9S", "10H", "JD", "KC"], // wins only final side pot
    ];
    const invested = [100, 200, 300, 500];
    const table = {
      ...state,
      players: state.players.map((p, idx) => ({
        ...p,
        hand: hands[idx],
        totalInvested: invested[idx],
        stack: 0,
        allIn: true,
        folded: false,
      })),
      pots: [],
    };

    const result = engine.resolveShowdown(table);

    expect(result.summary.map((pot) => pot.potAmount)).toEqual([400, 300, 200, 200]);
    expect(result.summary.map((pot) => pot.payouts[0]?.seatIndex)).toEqual([2, 2, 2, 3]);
    expect(result.summary.map((pot) => pot.payouts[0]?.payout)).toEqual([400, 300, 200, 200]);
    expect(result.state.players.map((player) => player.stack)).toEqual([0, 0, 900, 200]);
  });

  it("splits odd chips evenly among tied winners", () => {
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 100,
      dealerIndex: 0,
    });

    const table = {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        holeCards: ["AS", "2H", "3D", "4C"],
        hand: ["AS", "2H", "3D", "4C"],
        betThisRound: 0,
        folded: false,
      })),
      pots: [{ amount: 10, eligible: [0, 1, 2] }],
    };

    const result = engine.resolveShowdown(table);
    const payouts = result.summary[0].payouts;
    const total = payouts.reduce((sum, entry) => sum + entry.payout, 0);
    expect(total).toBe(10);
    const amounts = payouts.map((entry) => entry.payout);
    expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
  });

  it("includes showdown summary when advancing past final draw", () => {
    const base = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 100,
      dealerIndex: 0,
    });

    const ready = {
      ...base,
      players: base.players.map((p) => ({
        ...p,
        holeCards: ["AS", "2H", "3D", "4C"],
        hand: ["AS", "2H", "3D", "4C"],
        betThisRound: 10,
        folded: false,
      })),
      pots: [{ amount: 30, eligible: [0, 1, 2] }],
    };

    const outcome = engine.advanceAfterBet(ready, {
      drawRound: 3,
      maxDraws: 3,
      dealerIndex: 0,
      numPlayers: 3,
    });

    expect(outcome.street).toBe("SHOWDOWN");
    expect(outcome.showdownSummary).toBeDefined();
    expect(outcome.showdownSummary[0].payouts[0].payout).toBe(10);
  });
});
