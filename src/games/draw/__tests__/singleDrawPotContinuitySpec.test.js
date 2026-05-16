import { describe, expect, it } from "vitest";
import { AceToFiveSingleDrawController } from "../AceToFiveSingleDrawController.js";
import { AceToFiveSingleDrawEngine } from "../AceToFiveSingleDrawEngine.js";
import { DeuceToSevenSingleDrawController } from "../DeuceToSevenSingleDrawController.js";
import { DeuceToSevenSingleDrawEngine } from "../DeuceToSevenSingleDrawEngine.js";

const variants = [
  ["S01", DeuceToSevenSingleDrawController, DeuceToSevenSingleDrawEngine],
  ["S02", AceToFiveSingleDrawController, AceToFiveSingleDrawEngine],
];

function makeController(ControllerClass, EngineClass) {
  return new ControllerClass({
    engine: new EngineClass(),
    tableConfig: {
      seatConfig: ["HUMAN", "CPU"],
      dealerIndex: 0,
      startingStack: 500,
      structure: { sb: 10, bb: 20 },
    },
  });
}

describe("Single Draw pot continuity spec", () => {
  it.fails.each(variants)("%s blinds produce a nonzero pot obligation in canonical snapshot pot", (_id, ControllerClass, EngineClass) => {
    const game = makeController(ControllerClass, EngineClass);
    const state = game.createNewHandState(game.createInitialState());

    expect(state.snapshot.pot).toBeGreaterThan(0);
    expect(state.snapshot.metadata.lastBlinds).toMatchObject({ sb: 10, bb: 20 });
  });

  it.each(variants)("%s pot survives transition from pre-draw betting to draw", (_id, ControllerClass, EngineClass) => {
    const game = makeController(ControllerClass, EngineClass);
    let state = game.createNewHandState(game.createInitialState());
    const openingPot = state.snapshot.pot;
    state = game.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
    state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;

    expect(state.snapshot.phase).toBe("DRAW");
    expect(state.snapshot.pot).toBeGreaterThanOrEqual(openingPot);
  });

  it.each(variants)("%s pot survives draw-to-final-bet transition", (_id, ControllerClass, EngineClass) => {
    const game = makeController(ControllerClass, EngineClass);
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
    state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;
    const drawPot = state.snapshot.pot;
    state = game.applyAction(state, { seatIndex: 1, type: "DRAW", discardIndexes: [] }).state;
    state = game.applyAction(state, { seatIndex: 0, type: "DRAW", discardIndexes: [] }).state;

    expect(state.snapshot.phase).toBe("BET");
    expect(state.snapshot.pot).toBeGreaterThanOrEqual(drawPot);
  });

  it.fails.each(variants)("%s new hand starts with fresh blind pot state after terminal result", (_id, ControllerClass, EngineClass) => {
    const game = makeController(ControllerClass, EngineClass);
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "FOLD" }).state;
    expect(state.snapshot.phase).toBe("SHOWDOWN");

    const next = game.createNewHandState(state);
    expect(next.snapshot.phase).toBe("BET");
    expect(next.snapshot.drawRound).toBe(0);
    expect(next.snapshot.pot).toBeGreaterThan(0);
  });
});
