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

describe("Single Draw showdown and next hand spec", () => {
  it.each(variants)("%s fold-to-one produces a single winner result", (_id, ControllerClass, EngineClass) => {
    const game = makeController(ControllerClass, EngineClass);
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "FOLD" }).state;

    expect(state.snapshot.phase).toBe("SHOWDOWN");
    expect(state.snapshot.lastHandResult?.winners).toHaveLength(1);
    expect(state.snapshot.lastHandResult?.pot).toBeGreaterThan(0);
  });

  it.each(variants)("%s next hand resets street state while preserving playable stacks and blind pot", (_id, ControllerClass, EngineClass) => {
    const game = makeController(ControllerClass, EngineClass);
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "FOLD" }).state;
    const next = game.createNewHandState(state);

    expect(next.snapshot.phase).toBe("BET");
    expect(next.snapshot.drawRound).toBe(0);
    expect(next.snapshot.pot).toBeGreaterThan(0);
    expect(next.snapshot.players.every((player) => player.stack > 0)).toBe(true);
  });
});
