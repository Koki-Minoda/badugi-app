import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawController } from "../DeuceToSevenTripleDrawController.js";
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

function buildController(cards = []) {
  return new DeuceToSevenTripleDrawController({
    engine: new DeuceToSevenTripleDrawEngine({
      deckManager: new FakeDeckManager(cards),
    }),
    tableConfig: {
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
      structure: { sb: 10, bb: 20 },
    },
  });
}

describe("DeuceToSevenTripleDrawController", () => {
  it("starts a D01 hand and returns a UI-compatible snapshot", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const initial = controller.createInitialState();
    const state = controller.createNewHandState(initial);
    const snapshot = controller.getUiSnapshot(state);

    expect(snapshot.gameId).toBe("deuce_to_seven_triple_draw");
    expect(snapshot.variantId).toBe("D01");
    expect(snapshot.phase).toBe("BET");
    expect(snapshot.drawRound).toBe(0);
    expect(snapshot.players).toHaveLength(2);
    expect(snapshot.players[0].hand).toHaveLength(5);
    expect(snapshot.players[0].cards).toEqual(snapshot.players[0].hand);
    expect(snapshot.players[0].selected).toEqual([]);
    expect(snapshot.maxDiscardCount).toBe(5);
    expect(snapshot.handCardCount).toBe(5);
    expect(snapshot.turn).toBe(1);
    expect(snapshot.currentBet).toBe(20);
  });

  it("preserves current ring-game stacks when starting the next hand", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
      "2C", "3C", "4C", "5C", "9C",
      "2D", "3D", "4D", "5D", "9D",
    ]);
    const initial = controller.createInitialState();
    const state = controller.createNewHandState(initial, {
      currentPlayers: [
        { playerId: "hero", name: "Hero", stack: 650, avatar: "/characters/01.png" },
        { playerId: "villain", name: "Villain", stack: 350, avatar: "/characters/02.png" },
      ],
      structure: { sb: 0, bb: 0, ante: 0 },
    });
    const snapshot = controller.getUiSnapshot(state);

    expect(snapshot.players[0]).toMatchObject({
      playerId: "hero",
      name: "Hero",
      stack: 650,
      avatar: "/characters/01.png",
    });
    expect(snapshot.players[1]).toMatchObject({
      playerId: "villain",
      name: "Villain",
      stack: 350,
      avatar: "/characters/02.png",
    });
  });

  it("exposes legal BET actions for the acting seat", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());

    expect(controller.getLegalActions(state, 0)).toEqual([]);
    expect(controller.getLegalActions(state, 1).map((action) => action.type)).toEqual([
      "FOLD",
      "CALL",
      "RAISE",
    ]);
  });

  it("exposes legal DRAW action only for the current draw actor", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    let state = controller.createNewHandState(controller.createInitialState());
    state = controller.applyAction(state, { seatIndex: 1, type: "CALL" }).state;
    state = controller.applyAction(state, { seatIndex: 0, type: "CHECK" }).state;

    expect(state.snapshot.phase).toBe("DRAW");
    expect(state.snapshot.turn).toBe(1);
    expect(controller.getLegalActions(state, 0)).toEqual([]);
    expect(controller.getLegalActions(state, 1)).toEqual([
      { type: "DRAW", minDiscard: 0, maxDiscard: 5 },
    ]);
  });

  it("exposes the D01 rule-based CPU action through the controller", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());
    state.engineState.players[1].hand = ["7S", "5D", "4C", "3H", "2S"];

    expect(controller.getCpuAction(state, 1)).toMatchObject({
      seatIndex: 1,
      type: "RAISE",
      metadata: { strategy: "ruleBasedD01", raiseReason: "strongPat" },
    });
    expect(controller.getCpuAction(state, 0)).toBeNull();
  });

  it("applies betting actions and emits a bet-round completion event", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    let state = controller.createNewHandState(controller.createInitialState());

    let result = controller.applyAction(state, {
      seatIndex: 1,
      type: "CALL",
    });
    expect(result.events[0]).toMatchObject({ type: "actionApplied", seatIndex: 1 });
    state = result.state;

    result = controller.applyAction(state, {
      seatIndex: 0,
      type: "CHECK",
    });

    expect(result.events[0]).toMatchObject({ type: "betRoundComplete", drawRound: 1 });
    expect(result.state.snapshot.phase).toBe("DRAW");
    expect(result.state.snapshot.drawRound).toBe(1);
    expect(result.state.snapshot.pot).toBe(40);
  });

  it("normalizes drawIndexes into discardIndexes and returns to BET after all draw", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
      "9S", "10S",
    ]);
    let state = controller.createNewHandState(controller.createInitialState());
    state = controller.applyAction(state, { seatIndex: 1, type: "CALL" }).state;
    state = controller.applyAction(state, { seatIndex: 0, type: "CHECK" }).state;

    let result = controller.applyAction(state, {
      seatIndex: 1,
      payload: { type: "DRAW", drawIndexes: [3, 4] },
    });
    expect(result.events[0]).toMatchObject({ type: "drawAction", seatIndex: 1, drawCount: 2 });
    expect(result.state.snapshot.players[1].lastAction).toBe("DRAW(2)");
    expect(result.state.snapshot.phase).toBe("DRAW");

    result = controller.applyAction(result.state, {
      seatIndex: 0,
      payload: { type: "DRAW", drawIndexes: [] },
    });
    expect(result.events[0]).toMatchObject({ type: "drawRoundComplete", drawRound: 1 });
    expect(result.state.snapshot.phase).toBe("BET");
    expect(result.state.snapshot.players[0].lastAction).toBe("Pat");
  });

  it("returns invalidAction events without mutating state for bad controller input", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());

    const missingSeat = controller.applyAction(state, { type: "CALL" });
    expect(missingSeat.events[0]).toMatchObject({
      type: "invalidAction",
      error: "seatIndex is required",
    });
    expect(missingSeat.state).toBe(state);

    const outOfTurn = controller.applyAction(state, { seatIndex: 0, type: "CALL" });
    expect(outOfTurn.events[0]).toMatchObject({
      type: "invalidAction",
    });
    expect(outOfTurn.events[0].error).toMatch(/out of turn/);
    expect(outOfTurn.state).toBe(state);
  });

  it("returns overlay-ready 2-7 hand labels in lastHandResult", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());
    state.engineState.players[0].hand = ["7S", "5D", "4C", "3H", "2S"];
    state.engineState.players[1].hand = ["8S", "5H", "4D", "3C", "2D"];
    state.engineState.players[0].bet = 0;
    state.engineState.players[1].bet = 0;
    state.engineState.players[0].totalInvested = 0;
    state.engineState.players[1].totalInvested = 0;
    state.engineState.pots = [{ amount: 100, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const showdown = controller.engine.resolveShowdown(state.engineState).state;
    const snapshot = controller.getUiSnapshot(showdown);

    expect(snapshot.lastHandResult.pot).toBe(100);
    expect(snapshot.lastHandResult.potDetails[0].winners[0]).toMatchObject({
      seatIndex: 0,
      payout: 100,
      handLabel: "2-7 Low 7-5-4-3-2",
    });
    expect(snapshot.lastHandResult.winners[0].handLabel).toBe("2-7 Low 7-5-4-3-2");
  });

  it("emits handComplete and exposes winners after a fold win", () => {
    const controller = buildController([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
    ]);
    const state = controller.createNewHandState(controller.createInitialState());

    const result = controller.applyAction(state, {
      seatIndex: 1,
      type: "FOLD",
    });

    expect(result.events[0]).toMatchObject({
      type: "handComplete",
      totalPot: 30,
    });
    expect(result.state.snapshot.phase).toBe("SHOWDOWN");
    expect(controller.isHandFinished(result.state)).toBe(true);
    expect(controller.getWinners(result.state)).toEqual([
      expect.objectContaining({
        seatIndex: 0,
        payout: 30,
      }),
    ]);
  });
});
