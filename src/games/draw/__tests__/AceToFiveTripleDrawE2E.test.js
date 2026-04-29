import { describe, expect, it } from "vitest";
import { AceToFiveTripleDrawController } from "../AceToFiveTripleDrawController.js";
import { AceToFiveTripleDrawEngine } from "../AceToFiveTripleDrawEngine.js";

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

function buildController(cards = [
  "AS", "2S", "3S", "4S", "5S",
  "6D", "4C", "3H", "2D", "AC",
]) {
  return new AceToFiveTripleDrawController({
    engine: new AceToFiveTripleDrawEngine({
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

function chooseDeterministicAction(controller, state) {
  const seatIndex = state.snapshot.turn;
  const actions = controller.getLegalActions(state, seatIndex);
  if (state.snapshot.phase === "DRAW") {
    return { seatIndex, payload: { type: "DRAW", discardIndexes: [] } };
  }
  if (actions.some((action) => action.type === "CHECK")) {
    return { seatIndex, type: "CHECK" };
  }
  if (actions.some((action) => action.type === "CALL")) {
    return { seatIndex, type: "CALL" };
  }
  throw new Error(`No deterministic action for phase=${state.snapshot.phase} seat=${seatIndex}`);
}

describe("D02 A-5 Triple Draw e2e hand flow", () => {
  it("plays one controller hand through showdown with A-5 wheel labels", () => {
    const controller = buildController();
    let state = controller.createNewHandState(controller.createInitialState());
    const events = [...state.lastEvents];

    while (!controller.isHandFinished(state)) {
      const result = controller.applyAction(state, chooseDeterministicAction(controller, state));
      events.push(...result.events);
      state = result.state;
    }

    expect(state.snapshot).toMatchObject({
      gameId: "ace_to_five_triple_draw",
      variantId: "D02",
      phase: "SHOWDOWN",
      drawRound: 3,
      maxDiscardCount: 5,
      handCardCount: 5,
    });
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["handStarted", "betRoundComplete", "drawRoundComplete", "handComplete"]),
    );
    expect(controller.getWinners(state)).toEqual([
      expect.objectContaining({
        seatIndex: 0,
        payout: 40,
        handLabel: "A-5 Low 5-4-3-2-A",
      }),
    ]);
  });

  it("lets a one-card draw improve into the winning A-5 wheel", () => {
    const controller = buildController([
      "KS", "5D", "4C", "3H", "2S",
      "6D", "4D", "3D", "2D", "AC",
      "AS",
    ]);
    let state = controller.createNewHandState(controller.createInitialState());

    state = controller.applyAction(state, { seatIndex: 1, type: "CALL" }).state;
    state = controller.applyAction(state, { seatIndex: 0, type: "CHECK" }).state;
    state = controller.applyAction(state, {
      seatIndex: 1,
      payload: { type: "DRAW", discardIndexes: [] },
    }).state;

    let result = controller.applyAction(state, {
      seatIndex: 0,
      payload: { type: "DRAW", discardIndexes: [0] },
    });
    expect(result.events[0]).toMatchObject({ type: "drawRoundComplete", drawRound: 1 });
    expect(result.state.snapshot.players[0].lastAction).toBe("DRAW(1)");
    state = result.state;

    while (!controller.isHandFinished(state)) {
      result = controller.applyAction(state, chooseDeterministicAction(controller, state));
      state = result.state;
    }

    expect(state.snapshot.players[0].hand).toEqual(["5D", "4C", "3H", "2S", "AS"]);
    expect(controller.getWinners(state)).toEqual([
      expect.objectContaining({
        seatIndex: 0,
        payout: 40,
        handLabel: "A-5 Low 5-4-3-2-A",
      }),
    ]);
  });
});
