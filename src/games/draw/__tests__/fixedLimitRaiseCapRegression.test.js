import { describe, expect, it } from "vitest";
import { AceToFiveSingleDrawController } from "../AceToFiveSingleDrawController.js";
import { AceToFiveSingleDrawEngine } from "../AceToFiveSingleDrawEngine.js";
import { AceToFiveTripleDrawController } from "../AceToFiveTripleDrawController.js";
import { AceToFiveTripleDrawEngine } from "../AceToFiveTripleDrawEngine.js";
import { DeuceToSevenSingleDrawController } from "../DeuceToSevenSingleDrawController.js";
import { DeuceToSevenSingleDrawEngine } from "../DeuceToSevenSingleDrawEngine.js";
import { DeuceToSevenTripleDrawController } from "../DeuceToSevenTripleDrawController.js";
import { DeuceToSevenTripleDrawEngine } from "../DeuceToSevenTripleDrawEngine.js";

const CASES = [
  ["D01", DeuceToSevenTripleDrawController, DeuceToSevenTripleDrawEngine],
  ["D02", AceToFiveTripleDrawController, AceToFiveTripleDrawEngine],
  ["S01", DeuceToSevenSingleDrawController, DeuceToSevenSingleDrawEngine],
  ["S02", AceToFiveSingleDrawController, AceToFiveSingleDrawEngine],
];

function buildController(ControllerClass, EngineClass) {
  return new ControllerClass({
    engine: new EngineClass(),
    tableConfig: {
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
      structure: { sb: 10, bb: 20 },
    },
  });
}

describe("Core draw lowball fixed-limit raise cap", () => {
  it.each(CASES)("%s exposes a short all-in overcall instead of a rejected check", (_, ControllerClass, EngineClass) => {
    const controller = buildController(ControllerClass, EngineClass);
    const state = controller.createNewHandState(controller.createInitialState());
    state.engineState.street = "BET";
    state.engineState.actingPlayerIndex = 0;
    state.engineState.metadata.currentBet = 30;
    state.engineState.players[0] = {
      ...state.engineState.players[0],
      stack: 100,
      bet: 30,
      hasActedThisRound: false,
      folded: false,
      allIn: false,
    };
    state.engineState.players[1] = {
      ...state.engineState.players[1],
      stack: 0,
      bet: 40,
      hasActedThisRound: true,
      folded: false,
      allIn: true,
    };

    const snapshot = controller.getUiSnapshot(state.engineState);
    expect(snapshot.currentBet).toBe(40);
    const legalActions = controller.getLegalActions(state, 0).map((action) => action.type);
    expect(legalActions).toContain("CALL");
    expect(legalActions).not.toContain("CHECK");

    const result = controller.applyAction(state, { seatIndex: 0, type: "CALL" });
    expect(result.events.find((event) => event.type === "invalidAction")).toBeUndefined();
  });

  it.each(CASES)("%s hides/rejects raises after the five-bet cap", (_, ControllerClass, EngineClass) => {
    const controller = buildController(ControllerClass, EngineClass);
    const state = controller.createNewHandState(controller.createInitialState());
    state.engineState.street = "BET";
    state.engineState.actingPlayerIndex = 1;
    state.engineState.metadata.currentBet = 20;
    state.engineState.metadata.raiseCap = 4;
    state.engineState.metadata.raiseCountThisRound = 4;

    const legalActions = controller.getLegalActions(state, 1).map((action) => action.type);
    expect(legalActions).not.toContain("RAISE");
    expect(legalActions).not.toContain("BET");

    const result = controller.applyAction(state, { seatIndex: 1, type: "RAISE" });
    expect(result.state).toBe(state);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "invalidAction",
        error: expect.stringMatching(/raise cap/i),
      }),
    );
  });

  it.each(CASES)("%s allows exactly the fourth raise before the cap closes", (_, ControllerClass, EngineClass) => {
    const controller = buildController(ControllerClass, EngineClass);
    const state = controller.createNewHandState(controller.createInitialState());
    state.engineState.street = "BET";
    state.engineState.actingPlayerIndex = 1;
    state.engineState.metadata.currentBet = 20;
    state.engineState.metadata.raiseCap = 4;
    state.engineState.metadata.raiseCountThisRound = 3;

    const legalActions = controller.getLegalActions(state, 1).map((action) => action.type);
    expect(legalActions).toContain("RAISE");

    const result = controller.applyAction(state, { seatIndex: 1, type: "RAISE" });
    expect(result.events.find((event) => event.type === "invalidAction")).toBeUndefined();
    expect(result.state.engineState.metadata.raiseCountThisRound).toBe(4);
  });
});
