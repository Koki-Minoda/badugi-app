import { describe, expect, it } from "vitest";
import { AceToFiveSingleDrawController } from "../AceToFiveSingleDrawController.js";
import { AceToFiveSingleDrawEngine } from "../AceToFiveSingleDrawEngine.js";
import { DeuceToSevenSingleDrawController } from "../DeuceToSevenSingleDrawController.js";
import { DeuceToSevenSingleDrawEngine } from "../DeuceToSevenSingleDrawEngine.js";

const variants = [
  ["S01", DeuceToSevenSingleDrawController, DeuceToSevenSingleDrawEngine],
  ["S02", AceToFiveSingleDrawController, AceToFiveSingleDrawEngine],
];

function controller(ControllerClass, EngineClass, { seatConfig, dealerIndex = 0 } = {}) {
  return new ControllerClass({
    engine: new EngineClass(),
    tableConfig: {
      seatConfig,
      dealerIndex,
      startingStack: 500,
      structure: { sb: 10, bb: 20 },
    },
  });
}

function newHand(ControllerClass, EngineClass, opts) {
  const game = controller(ControllerClass, EngineClass, opts);
  return { game, state: game.createNewHandState(game.createInitialState()) };
}

describe("Single Draw betting order spec", () => {
  it.each(variants)("%s 6max pre-draw first actor is UTG left of BB, not BB", (_id, ControllerClass, EngineClass) => {
    const { state } = newHand(ControllerClass, EngineClass, {
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"],
      dealerIndex: 0,
    });

    expect(state.snapshot.metadata.lastBlinds).toMatchObject({ sbIndex: 1, bbIndex: 2 });
    expect(state.snapshot.turn).toBe(3);
    expect(state.snapshot.turn).not.toBe(state.snapshot.metadata.lastBlinds.bbIndex);
  });

  it.each(variants)("%s 3way pre-draw first actor is UTG left of BB, not BB", (_id, ControllerClass, EngineClass) => {
    const { state } = newHand(ControllerClass, EngineClass, {
      seatConfig: ["HUMAN", "CPU", "CPU"],
      dealerIndex: 0,
    });

    expect(state.snapshot.metadata.lastBlinds).toMatchObject({ sbIndex: 1, bbIndex: 2 });
    expect(state.snapshot.turn).toBe(0);
    expect(state.snapshot.turn).not.toBe(state.snapshot.metadata.lastBlinds.bbIndex);
  });

  it.each(variants)("%s heads-up pre-draw first actor is BTN/SB", (_id, ControllerClass, EngineClass) => {
    const { state } = newHand(ControllerClass, EngineClass, {
      seatConfig: ["HUMAN", "CPU"],
      dealerIndex: 0,
    });

    expect(state.snapshot.metadata.lastBlinds).toMatchObject({ sbIndex: 0, bbIndex: 1 });
    expect(state.snapshot.turn).toBe(0);
  });

  it.each(variants)("%s post-draw first actor is first active left of the button", (_id, ControllerClass, EngineClass) => {
    const { game, state } = newHand(ControllerClass, EngineClass, {
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU"],
      dealerIndex: 0,
    });
    const drawState = game.engine.transitionToDraw(state.engineState, 1);
    const betState = game.engine.transitionToBet(drawState);

    expect(betState.street).toBe("BET");
    expect(betState.actingPlayerIndex).toBe(1);
  });

  it.each(variants)("%s post-draw first actor skips folded and all-in seats", (_id, ControllerClass, EngineClass) => {
    const { game, state } = newHand(ControllerClass, EngineClass, {
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU"],
      dealerIndex: 0,
    });
    let drawState = game.engine.transitionToDraw(state.engineState, 1);
    drawState.players[1] = { ...drawState.players[1], folded: true };
    drawState.players[2] = { ...drawState.players[2], allIn: true, stack: 0 };
    const betState = game.engine.transitionToBet(drawState);

    expect(betState.actingPlayerIndex).toBe(3);
  });
});
