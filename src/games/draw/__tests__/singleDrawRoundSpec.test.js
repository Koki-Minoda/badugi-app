import { describe, expect, it } from "vitest";
import { AceToFiveSingleDrawController } from "../AceToFiveSingleDrawController.js";
import { AceToFiveSingleDrawEngine } from "../AceToFiveSingleDrawEngine.js";
import { DeuceToSevenSingleDrawController } from "../DeuceToSevenSingleDrawController.js";
import { DeuceToSevenSingleDrawEngine } from "../DeuceToSevenSingleDrawEngine.js";

const variants = [
  ["S01", DeuceToSevenSingleDrawController, DeuceToSevenSingleDrawEngine],
  ["S02", AceToFiveSingleDrawController, AceToFiveSingleDrawEngine],
];

function drawState(ControllerClass, EngineClass) {
  const game = new ControllerClass({
    engine: new EngineClass(),
    tableConfig: {
      seatConfig: ["HUMAN", "CPU"],
      dealerIndex: 0,
      startingStack: 500,
      structure: { sb: 10, bb: 20 },
    },
  });
  let state = game.createNewHandState(game.createInitialState());
  state = game.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
  state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;
  return { game, state };
}

describe("Single Draw round spec", () => {
  it.each(variants)("%s each player starts with five cards", (_id, ControllerClass, EngineClass) => {
    const { state } = drawState(ControllerClass, EngineClass);

    expect(state.snapshot.players[0].hand).toHaveLength(5);
    expect(state.snapshot.players[1].hand).toHaveLength(5);
  });

  it.each(variants)("%s discard 0 is pat and discard 1-5 is valid", (_id, ControllerClass, EngineClass) => {
    const { game, state } = drawState(ControllerClass, EngineClass);
    let result = game.applyAction(state, { seatIndex: 1, type: "DRAW", discardIndexes: [] });
    expect(result.events[0]).toMatchObject({ type: "drawAction", drawCount: 0 });

    result = game.applyAction(result.state, {
      seatIndex: 0,
      type: "DRAW",
      discardIndexes: [0, 1, 2, 3, 4],
    });
    expect(result.events[0]).toMatchObject({ type: "drawRoundComplete" });
    expect(result.state.snapshot.phase).toBe("BET");
  });

  it.each(variants)("%s discard count above five is rejected", (_id, ControllerClass, EngineClass) => {
    const { game, state } = drawState(ControllerClass, EngineClass);
    const result = game.applyAction(state, {
      seatIndex: 1,
      type: "DRAW",
      discardIndexes: [0, 1, 2, 3, 4, 5],
    });

    expect(result.events[0]).toMatchObject({ type: "invalidAction" });
    expect(result.state).toBe(state);
  });

  it.each(variants)("%s has exactly one draw round and no draw2/draw3", (_id, ControllerClass, EngineClass) => {
    const { game } = drawState(ControllerClass, EngineClass);
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
    state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;

    expect(state.snapshot.phase).toBe("DRAW");
    expect(state.snapshot.drawRound).toBe(1);
    state = game.applyAction(state, { seatIndex: 1, type: "DRAW", discardIndexes: [] }).state;
    state = game.applyAction(state, { seatIndex: 0, type: "DRAW", discardIndexes: [] }).state;
    state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;
    state = game.applyAction(state, { seatIndex: 0, type: "CHECK" }).state;

    expect(state.snapshot.phase).toBe("SHOWDOWN");
    expect(state.snapshot.drawRound).toBe(1);
  });
});
