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
});
