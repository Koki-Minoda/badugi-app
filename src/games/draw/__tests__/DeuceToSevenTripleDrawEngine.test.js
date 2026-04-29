import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawEngine } from "../DeuceToSevenTripleDrawEngine.js";

class FakeDeckManager {
  constructor(cards = []) {
    this.cards = [...cards];
    this.discardPile = [];
  }

  reset() {}

  draw(count = 1) {
    return this.cards.splice(0, count);
  }

  discard(cards = []) {
    this.discardPile.push(...cards);
  }
}

function allCards(players) {
  return players.flatMap((player) => player.hand ?? []);
}

describe("DeuceToSevenTripleDrawEngine", () => {
  it("initializes D01 with five cards and three draw rounds", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.initHand({
      handId: "d01-hand-1",
      seatConfig: ["HUMAN", "CPU", "CPU", "EMPTY"],
      startingStack: 500,
      dealerIndex: 0,
      structure: { sb: 10, bb: 20 },
    });

    expect(engine.id).toBe("deuce_to_seven_triple_draw");
    expect(engine.variantId).toBe("D01");
    expect(engine.maxDrawRounds).toBe(3);
    expect(state.gameId).toBe("deuce_to_seven_triple_draw");
    expect(state.street).toBe("BET");
    expect(state.drawRoundIndex).toBe(0);
    expect(state.players[0].hand).toHaveLength(5);
    expect(state.players[1].hand).toHaveLength(5);
    expect(state.players[2].hand).toHaveLength(5);
    expect(state.players[3].hand).toHaveLength(0);
    expect(new Set(allCards(state.players)).size).toBe(15);
    expect(state.metadata).toMatchObject({
      variantId: "D01",
      bettingStructure: "fixed-limit",
      evaluator: "low-27",
      maxDrawRounds: 3,
      raiseCap: 4,
    });
  });

  it("applies blinds using the draw base forced-bet path", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
      structure: { sb: 10, bb: 20 },
    });

    const withBlinds = engine.applyForcedBets(state);

    expect(withBlinds.players[0]).toMatchObject({ stack: 500, bet: 0 });
    expect(withBlinds.players[1]).toMatchObject({ stack: 490, bet: 10, lastAction: "SB" });
    expect(withBlinds.players[2]).toMatchObject({ stack: 480, bet: 20, lastAction: "BB" });
    expect(withBlinds.metadata.currentBet).toBe(20);
  });

  it("formats 2-7 showdown labels from the evaluator", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const result = engine.evaluateShowdownHand(["7S", "5D", "4C", "3H", "2S"]);

    expect(result.handName).toBe("2-7 Low 7-5-4-3-2");
    expect(result.metadata.ranks).toEqual([7, 5, 4, 3, 2]);
  });

  it("chooses pat for made 8-low CPU draw decisions", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.transitionToDraw(
      engine.initHand({ seatConfig: ["HUMAN", "CPU"], dealerIndex: 0 }),
      1,
    );
    state.actingPlayerIndex = 1;
    state.players[1].hand = ["8S", "7D", "5C", "3H", "2S"];

    const action = engine.chooseCpuAction(state, 1);

    expect(action).toMatchObject({
      seatIndex: 1,
      type: "DRAW",
      discardIndexes: [],
      metadata: { strategy: "ruleBasedD01", pat: true, drawCount: 0 },
    });
  });

  it("uses a lowball draw-count heuristic for weak CPU hands", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.transitionToDraw(
      engine.initHand({ seatConfig: ["HUMAN", "CPU"], dealerIndex: 0 }),
      1,
    );
    state.actingPlayerIndex = 1;
    state.players[1].hand = ["2S", "2H", "9C", "KD", "QS"];

    const action = engine.chooseCpuAction(state, 1);

    expect(action).toMatchObject({
      seatIndex: 1,
      type: "DRAW",
      discardIndexes: [1, 3, 4],
      metadata: { strategy: "ruleBasedD01", drawCount: 3 },
    });
  });

  it("raises strong pat lows and folds weak late draws facing a bet", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.applyForcedBets(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
        structure: { sb: 10, bb: 20 },
      }),
    );
    state.actingPlayerIndex = 1;
    state.players[1].hand = ["7S", "5D", "4C", "3H", "2S"];

    expect(engine.chooseCpuAction(state, 1)).toMatchObject({
      seatIndex: 1,
      type: "RAISE",
      metadata: { raiseReason: "strongPat" },
    });

    state.metadata.raiseCountThisRound = 3;
    state.drawRoundIndex = 2;
    state.players[1].hand = ["2S", "2H", "QC", "KD", "JS"];
    expect(engine.chooseCpuAction(state, 1)).toMatchObject({
      seatIndex: 1,
      type: "FOLD",
      metadata: { foldReason: "weakLateDraw" },
    });
  });

  it("advances from an opening bet round into draw round 1", () => {
    const engine = new DeuceToSevenTripleDrawEngine({
      deckManager: new FakeDeckManager([
        "2S", "3S", "4S", "5S", "7S",
        "2H", "3H", "4H", "5H", "8H",
        "2D", "3D", "4D", "5D", "9D",
      ]),
    });
    const state = engine.applyForcedBets(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
        structure: { sb: 10, bb: 20 },
      }),
    );

    const drawState = engine.advanceAfterBet(state);

    expect(drawState.street).toBe("DRAW");
    expect(drawState.drawRoundIndex).toBe(1);
    expect(drawState.pots[0]).toMatchObject({ amount: 30 });
    expect(drawState.players.map((player) => player.bet)).toEqual([0, 0, 0]);
    expect(drawState.metadata.pendingDrawSeats).toEqual([0, 1, 2]);
    expect(drawState.actingPlayerIndex).toBe(1);
  });

  it("replaces discarded cards and returns to betting after all active seats draw", () => {
    const deckManager = new FakeDeckManager([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
      "9S", "10S", "JS",
    ]);
    const engine = new DeuceToSevenTripleDrawEngine({ deckManager });
    const drawState = engine.transitionToDraw(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
      }),
      1,
    );

    const afterHero = engine.applyDrawAction(drawState, {
      seatIndex: 1,
      type: "DRAW",
      discardIndexes: [3, 4],
    });
    expect(afterHero.street).toBe("DRAW");
    expect(afterHero.players[1].hand).toEqual(["2H", "3H", "4H", "9S", "10S"]);
    expect(afterHero.players[1].lastAction).toBe("DRAW(2)");
    expect(afterHero.metadata.discardCountBySeat[1]).toBe(2);
    expect(deckManager.discardPile).toEqual(["5H", "8H"]);
    expect(afterHero.actingPlayerIndex).toBe(0);

    const afterCpu = engine.applyDrawAction(afterHero, {
      seatIndex: 0,
      type: "DRAW",
      discardIndexes: [],
    });
    expect(afterCpu.street).toBe("BET");
    expect(afterCpu.drawRoundIndex).toBe(1);
    expect(afterCpu.players[0].lastAction).toBe("Pat");
    expect(afterCpu.metadata.pendingDrawSeats).toEqual([]);
    expect(afterCpu.metadata.discardCountBySeat[0]).toBe(0);
  });

  it("rejects invalid discard indexes before mutating a draw hand", () => {
    const engine = new DeuceToSevenTripleDrawEngine({
      deckManager: new FakeDeckManager([
        "2S", "3S", "4S", "5S", "7S",
        "2H", "3H", "4H", "5H", "8H",
        "9S", "10S", "JS",
      ]),
    });
    const drawState = engine.transitionToDraw(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
      }),
      1,
    );
    const originalHand = [...drawState.players[1].hand];

    expect(() =>
      engine.applyDrawAction(drawState, {
        seatIndex: 1,
        type: "DRAW",
        discardIndexes: [0, 0],
      }),
    ).toThrow(/unique/);
    expect(() =>
      engine.applyDrawAction(drawState, {
        seatIndex: 1,
        type: "DRAW",
        discardIndexes: [5],
      }),
    ).toThrow(/out-of-range/);
    expect(drawState.players[1].hand).toEqual(originalHand);
  });

  it("skips all-in seats when building draw order", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });
    state.players[1].allIn = true;
    state.players[1].stack = 0;

    const drawState = engine.transitionToDraw(state, 1);

    expect(drawState.players[1]).toMatchObject({
      allIn: true,
      canDraw: false,
      hasDrawn: true,
    });
    expect(drawState.metadata.pendingDrawSeats).toEqual([0, 2]);
    expect(drawState.actingPlayerIndex).toBe(2);
  });

  it("moves to showdown after the third post-draw betting round", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });
    state.drawRoundIndex = 3;
    state.players[0].bet = 20;
    state.players[1].bet = 20;

    const showdownState = engine.advanceAfterBet(state);

    expect(showdownState.street).toBe("SHOWDOWN");
    expect(showdownState.isHandOver).toBe(true);
    expect(showdownState.metadata.showdownSummary[0]).toMatchObject({ potAmount: 40 });
    expect(showdownState.actingPlayerIndex).toBeNull();
  });

  it("completes a fixed-limit betting round when all active players match", () => {
    const engine = new DeuceToSevenTripleDrawEngine({
      deckManager: new FakeDeckManager([
        "2S", "3S", "4S", "5S", "7S",
        "2H", "3H", "4H", "5H", "8H",
      ]),
    });
    const state = engine.applyForcedBets(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
        structure: { sb: 10, bb: 20 },
      }),
    );
    state.actingPlayerIndex = 1;

    const called = engine.applyPlayerAction(state, {
      seatIndex: 1,
      type: "CALL",
    });
    expect(called.street).toBe("BET");
    expect(called.actingPlayerIndex).toBe(0);

    const drawState = engine.applyPlayerAction(called, {
      seatIndex: 0,
      type: "CHECK",
    });

    expect(drawState.street).toBe("DRAW");
    expect(drawState.drawRoundIndex).toBe(1);
    expect(drawState.pots[0]).toMatchObject({ amount: 40 });
    expect(drawState.players.map((player) => player.bet)).toEqual([0, 0]);
    expect(drawState.metadata.raiseCountThisRound).toBe(0);
  });

  it("allows fixed-limit raises and resets action before advancing", () => {
    const engine = new DeuceToSevenTripleDrawEngine({
      deckManager: new FakeDeckManager([
        "2S", "3S", "4S", "5S", "7S",
        "2H", "3H", "4H", "5H", "8H",
      ]),
    });
    const state = engine.applyForcedBets(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
        structure: { sb: 10, bb: 20 },
      }),
    );
    state.actingPlayerIndex = 1;

    const raised = engine.applyPlayerAction(state, {
      seatIndex: 1,
      type: "RAISE",
    });
    expect(raised.street).toBe("BET");
    expect(raised.metadata.currentBet).toBe(40);
    expect(raised.metadata.raiseCountThisRound).toBe(1);
    expect(raised.players[0].hasActedThisRound).toBe(false);
    expect(raised.actingPlayerIndex).toBe(0);

    const called = engine.applyPlayerAction(raised, {
      seatIndex: 0,
      type: "CALL",
    });
    expect(called.street).toBe("DRAW");
    expect(called.pots[0]).toMatchObject({ amount: 80 });
  });

  it("enforces the fixed-limit raise cap", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.applyForcedBets(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
        structure: { sb: 10, bb: 20 },
      }),
    );
    state.actingPlayerIndex = 1;
    state.metadata.raiseCountThisRound = 3;

    expect(() =>
      engine.applyPlayerAction(state, {
        seatIndex: 1,
        type: "RAISE",
      }),
    ).toThrow(/raise cap/);
  });

  it("resolves 2-7 showdown payouts", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });
    state.players[0].hand = ["7S", "5D", "4C", "3H", "2S"];
    state.players[1].hand = ["8S", "5H", "4D", "3C", "2D"];
    state.pots = [{ amount: 100, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const result = engine.resolveShowdown(state);

    expect(result.totalPot).toBe(100);
    expect(result.summary[0].payouts).toHaveLength(1);
    expect(result.summary[0].payouts[0]).toMatchObject({
      seatIndex: 0,
      payout: 100,
      handName: "2-7 Low 7-5-4-3-2",
    });
    expect(result.state.players[0].stack).toBe(600);
    expect(result.state.players[1].stack).toBe(500);
    expect(result.state.pots).toEqual([]);
  });

  it("splits tied 2-7 showdown pots by seat order with odd-chip remainder", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });
    state.players[0].hand = ["8S", "6D", "5C", "3H", "2S"];
    state.players[1].hand = ["8C", "6H", "5D", "3S", "2C"];
    state.pots = [{ amount: 101, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const result = engine.resolveShowdown(state);

    expect(result.summary[0].payouts).toEqual([
      expect.objectContaining({ seatIndex: 0, payout: 51 }),
      expect.objectContaining({ seatIndex: 1, payout: 50 }),
    ]);
    expect(result.state.players[0].stack).toBe(551);
    expect(result.state.players[1].stack).toBe(550);
  });

  it("resolves side pots with each pot restricted to eligible D01 seats", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });
    state.players[0].hand = ["7S", "5D", "4C", "3H", "2S"];
    state.players[1].hand = ["8S", "6D", "5C", "3S", "2C"];
    state.players[2].hand = ["9S", "6H", "5H", "3D", "2D"];
    state.pots = [
      { amount: 90, eligiblePlayerIds: ["seat-0", "seat-1", "seat-2"] },
      { amount: 40, eligiblePlayerIds: ["seat-1", "seat-2"] },
    ];

    const result = engine.resolveShowdown(state);

    expect(result.summary).toHaveLength(2);
    expect(result.summary[0].payouts).toEqual([
      expect.objectContaining({
        seatIndex: 0,
        payout: 90,
        handName: "2-7 Low 7-5-4-3-2",
      }),
    ]);
    expect(result.summary[1].payouts).toEqual([
      expect.objectContaining({
        seatIndex: 1,
        payout: 40,
        handName: "2-7 Low 8-6-5-3-2",
      }),
    ]);
    expect(result.state.players.map((player) => player.stack)).toEqual([590, 540, 500]);
  });

  it("awards the pot immediately when everyone else folds", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.applyForcedBets(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
        structure: { sb: 10, bb: 20 },
      }),
    );
    state.actingPlayerIndex = 1;

    const result = engine.applyPlayerAction(state, {
      seatIndex: 1,
      type: "FOLD",
    });

    expect(result.street).toBe("SHOWDOWN");
    expect(result.isHandOver).toBe(true);
    expect(result.metadata.showdownSummary[0]).toMatchObject({
      potAmount: 30,
      winType: "fold",
    });
    expect(result.metadata.showdownSummary[0].payouts[0]).toMatchObject({
      seatIndex: 0,
      payout: 30,
    });
  });
});
