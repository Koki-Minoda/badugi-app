import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawEngine } from "../DeuceToSevenTripleDrawEngine.js";
import { AceToFiveTripleDrawEngine } from "../AceToFiveTripleDrawEngine.js";
import { DeuceToSevenSingleDrawEngine } from "../DeuceToSevenSingleDrawEngine.js";
import { AceToFiveSingleDrawEngine } from "../AceToFiveSingleDrawEngine.js";

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

function bettingState(engine, playerOverrides = [], metadata = {}) {
  const state = engine.initHand({
    seatConfig: ["HUMAN", "CPU", "CPU", "CPU"],
    startingStack: 500,
    dealerIndex: 0,
    structure: { sb: 10, bb: 20 },
  });
  state.street = "BET";
  state.drawRoundIndex = 0;
  state.actingPlayerIndex = 1;
  state.players = state.players.map((player, seatIndex) => ({
    ...player,
    stack: 500,
    bet: 40,
    totalInvested: 0,
    folded: false,
    sittingOut: false,
    seatOut: false,
    allIn: false,
    hasActedThisRound: true,
    lastAction: "Call",
    ...(playerOverrides[seatIndex] ?? {}),
  }));
  state.metadata = {
    ...(state.metadata ?? {}),
    currentBet: 40,
    raiseCountThisRound: 1,
    ...metadata,
  };
  return state;
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

  it("skips busted blind seats and starts betting after the live big blind", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"],
      startingStack: 500,
      dealerIndex: 3,
      structure: { sb: 15, bb: 30 },
    });
    state.players[2] = {
      ...state.players[2],
      stack: 0,
      bet: 0,
      seatOut: true,
      sittingOut: true,
      isBusted: true,
      folded: true,
    };
    state.players[5] = {
      ...state.players[5],
      stack: 0,
      bet: 0,
      seatOut: true,
      sittingOut: true,
      isBusted: true,
      folded: true,
    };

    const withBlinds = engine.applyForcedBets(state);

    expect(withBlinds.players[4]).toMatchObject({ stack: 485, bet: 15, lastAction: "SB" });
    expect(withBlinds.players[0]).toMatchObject({ stack: 470, bet: 30, lastAction: "BB" });
    expect(withBlinds.players[5]).toMatchObject({ stack: 0, bet: 0 });
    expect(withBlinds.actingPlayerIndex).toBe(1);
    expect(withBlinds.lastAggressorIndex).toBe(0);
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
    state.metadata.currentBet = 40;
    state.drawRoundIndex = 2;
    state.players[0].bet = 40;
    state.players[1].bet = 20;
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

  it("keeps all-in live seats in draw order because they still exchange cards", () => {
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
      canDraw: true,
      hasDrawn: false,
    });
    expect(drawState.metadata.pendingDrawSeats).toEqual([0, 1, 2]);
    expect(drawState.actingPlayerIndex).toBe(1);
  });

  it("lets an all-in live draw seat complete its draw and then skips empty betting streets", () => {
    const engine = new DeuceToSevenTripleDrawEngine({
      deckManager: new FakeDeckManager([
        "2S", "3S", "4S", "5S", "7S",
        "2H", "3H", "4H", "5H", "8H",
        "9C", "TD", "JH", "QS", "KC",
      ]),
    });
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });
    state.players = state.players.map((player) => ({
      ...player,
      allIn: true,
      stack: 0,
      bet: 0,
      totalInvested: 100,
      hasActedThisRound: true,
    }));
    state.drawRoundIndex = 3;
    const drawState = engine.transitionToDraw(state, 3);

    const afterSeat1 = engine.applyDrawAction(drawState, {
      seatIndex: 1,
      type: "DRAW",
      discardIndexes: [],
    });
    expect(afterSeat1.street).toBe("DRAW");
    expect(afterSeat1.actingPlayerIndex).toBe(0);

    const afterSeat0 = engine.applyDrawAction(afterSeat1, {
      seatIndex: 0,
      type: "DRAW",
      discardIndexes: [],
    });

    expect(afterSeat0.street).toBe("SHOWDOWN");
    expect(afterSeat0.isHandOver).toBe(true);
    expect(afterSeat0.metadata.showdownTotal).toBe(200);
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
      type: "CALL",
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

  it("allows the fourth raise and rejects a raise beyond the five-bet cap", () => {
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

    const fourthRaise = engine.applyPlayerAction(state, {
      seatIndex: 1,
      type: "RAISE",
    });
    expect(fourthRaise.metadata.raiseCountThisRound).toBe(4);

    fourthRaise.actingPlayerIndex = 0;
    expect(() =>
      engine.applyPlayerAction(fourthRaise, {
        seatIndex: 0,
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

  it("does not let paired, straight, flush, or ace-low hands beat a clean 2-7 low", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const weakHands = [
      ["4S", "4D", "7C", "3H", "2S"],
      ["6S", "5D", "4C", "3H", "2S"],
      ["7S", "5S", "4S", "3S", "2S"],
      ["AS", "5D", "4C", "3H", "2S"],
    ];

    for (const weakHand of weakHands) {
      const state = engine.initHand({
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
      });
      state.players[0].hand = ["7S", "5D", "4C", "3H", "2S"];
      state.players[1].hand = weakHand;
      state.pots = [{ amount: 100, eligiblePlayerIds: ["seat-0", "seat-1"] }];

      const result = engine.resolveShowdown(state);

      expect(result.summary[0].payouts).toEqual([
        expect.objectContaining({
          seatIndex: 0,
          payout: 100,
          handName: "2-7 Low 7-5-4-3-2",
          finalLowRanks: [7, 5, 4, 3, 2],
        }),
      ]);
    }
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

describe("draw lowball fixed-limit all-in betting regressions", () => {
  const variants = [
    ["D01", () => new DeuceToSevenTripleDrawEngine()],
    ["D02", () => new AceToFiveTripleDrawEngine()],
    ["S01", () => new DeuceToSevenSingleDrawEngine()],
    ["S02", () => new AceToFiveSingleDrawEngine()],
  ];

  it.each(variants)(
    "%s treats a short all-in below the current bet as a non-reopening call",
    (_, createEngine) => {
      const engine = createEngine();
      const state = bettingState(engine, [
        { bet: 40, hasActedThisRound: true },
        {
          stack: 20,
          bet: 0,
          hasActedThisRound: false,
          lastAction: "",
        },
        { bet: 40, hasActedThisRound: true },
        { bet: 0, folded: true, hasActedThisRound: true, lastAction: "Fold" },
      ]);

      const next = engine.applyPlayerAction(state, {
        seatIndex: 1,
        type: "RAISE",
      });

      expect(next.street).toBe("DRAW");
      expect(next.metadata.raiseCountThisRound).toBe(0);
      expect(next.metadata.lastCommittedToPot).toBe(100);
      expect(next.players[1]).toMatchObject({
        stack: 0,
        allIn: true,
        bet: 0,
        lastAction: "Call",
      });
    },
  );

  it.each(variants)(
    "%s skips already matched seats and assigns the next genuinely pending actor",
    (_, createEngine) => {
      const engine = createEngine();
      const state = bettingState(engine, [
        { bet: 40, hasActedThisRound: true },
        { bet: 40, hasActedThisRound: false, lastAction: "" },
        { bet: 40, hasActedThisRound: true },
        { bet: 40, hasActedThisRound: false, lastAction: "" },
      ]);

      const next = engine.applyPlayerAction(state, {
        seatIndex: 1,
        type: "CHECK",
      });

      expect(next.street).toBe("BET");
      expect(next.actingPlayerIndex).toBe(3);
      expect(next.players[2].hasActedThisRound).toBe(true);
      expect(next.players[3].hasActedThisRound).toBe(false);
    },
  );
});
