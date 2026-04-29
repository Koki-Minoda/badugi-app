import { describe, expect, it } from "vitest";
import { AceToFiveSingleDrawController } from "../AceToFiveSingleDrawController.js";
import { AceToFiveSingleDrawEngine } from "../AceToFiveSingleDrawEngine.js";
import { DeuceToSevenSingleDrawController } from "../DeuceToSevenSingleDrawController.js";
import { DeuceToSevenSingleDrawEngine } from "../DeuceToSevenSingleDrawEngine.js";

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

function buildController(ControllerClass, EngineClass, cards) {
  return new ControllerClass({
    engine: new EngineClass({
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

describe("S01/S02 single draw e2e hand flow", () => {
  it("plays S01 through one draw and showdown", () => {
    const controller = buildController(DeuceToSevenSingleDrawController, DeuceToSevenSingleDrawEngine, [
      "7S", "5D", "4C", "3H", "2S",
      "8S", "6D", "5C", "3S", "2C",
    ]);
    let state = controller.createNewHandState(controller.createInitialState());
    const events = [...state.lastEvents];

    while (!controller.isHandFinished(state)) {
      const result = controller.applyAction(state, chooseDeterministicAction(controller, state));
      events.push(...result.events);
      state = result.state;
    }

    expect(state.snapshot).toMatchObject({
      gameId: "deuce_to_seven_single_draw",
      variantId: "S01",
      phase: "SHOWDOWN",
      drawRound: 1,
      maxDiscardCount: 5,
      handCardCount: 5,
    });
    expect(events.map((event) => event.type)).toEqual([
      "handStarted",
      "actionApplied",
      "betRoundComplete",
      "drawAction",
      "drawRoundComplete",
      "actionApplied",
      "handComplete",
    ]);
    expect(controller.getWinners(state)).toEqual([
      expect.objectContaining({
        seatIndex: 0,
        payout: 40,
        handLabel: "2-7 Low 7-5-4-3-2",
      }),
    ]);
  });

  it("plays S02 through one draw and showdown", () => {
    const controller = buildController(AceToFiveSingleDrawController, AceToFiveSingleDrawEngine, [
      "AS", "2S", "3S", "4S", "5S",
      "6D", "4C", "3H", "2D", "AC",
    ]);
    let state = controller.createNewHandState(controller.createInitialState());

    while (!controller.isHandFinished(state)) {
      state = controller.applyAction(state, chooseDeterministicAction(controller, state)).state;
    }

    expect(state.snapshot).toMatchObject({
      gameId: "ace_to_five_single_draw",
      variantId: "S02",
      phase: "SHOWDOWN",
      drawRound: 1,
    });
    expect(controller.getWinners(state)).toEqual([
      expect.objectContaining({
        seatIndex: 0,
        payout: 40,
        handLabel: "A-5 Low 5-4-3-2-A",
      }),
    ]);
  });
});
