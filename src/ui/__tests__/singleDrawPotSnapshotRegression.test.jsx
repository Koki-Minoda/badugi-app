import { describe, expect, it } from "vitest";
import { AceToFiveSingleDrawController } from "../../games/draw/AceToFiveSingleDrawController.js";
import { AceToFiveSingleDrawEngine } from "../../games/draw/AceToFiveSingleDrawEngine.js";
import { DeuceToSevenSingleDrawController } from "../../games/draw/DeuceToSevenSingleDrawController.js";
import { DeuceToSevenSingleDrawEngine } from "../../games/draw/DeuceToSevenSingleDrawEngine.js";
import { DrawLowballUIAdapter } from "../game/draw/DrawLowballUIAdapter.js";

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

describe("Single Draw pot snapshot regression", () => {
  it.each(variants)("%s exposes effective blind pot to UI snapshots", (_id, ControllerClass, EngineClass) => {
    const controller = makeController(ControllerClass, EngineClass);
    const state = controller.createNewHandState(controller.createInitialState());
    const adapter = new DrawLowballUIAdapter();
    const props = adapter.buildViewProps({
      controllerSnapshot: state.snapshot,
      tableConfig: { sbValue: 10, bbValue: 20, anteValue: 0, maxDraws: 1 },
    });

    expect(state.snapshot.pot).toBe(30);
    expect(props.potView.total).toBe(30);
    expect(state.snapshot.players[0].betThisRound).toBe(10);
    expect(state.snapshot.players[1].betThisRound).toBe(20);
  });

  it.each(variants)("%s starts the next hand with a fresh effective blind pot", (_id, ControllerClass, EngineClass) => {
    const controller = makeController(ControllerClass, EngineClass);
    let state = controller.createNewHandState(controller.createInitialState());
    state = controller.applyAction(state, { seatIndex: 0, type: "FOLD" }).state;
    const next = controller.createNewHandState(state);

    expect(state.snapshot.phase).toBe("SHOWDOWN");
    expect(state.snapshot.lastHandResult?.pot).toBeGreaterThan(0);
    expect(next.snapshot.phase).toBe("BET");
    expect(next.snapshot.pot).toBe(30);
    expect(next.snapshot.lastHandResult).toBeNull();
  });
});
