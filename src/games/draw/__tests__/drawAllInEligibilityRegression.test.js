import { describe, expect, it } from "vitest";
import { AceToFiveSingleDrawController } from "../AceToFiveSingleDrawController.js";
import { AceToFiveSingleDrawEngine } from "../AceToFiveSingleDrawEngine.js";
import { AceToFiveTripleDrawController } from "../AceToFiveTripleDrawController.js";
import { AceToFiveTripleDrawEngine } from "../AceToFiveTripleDrawEngine.js";
import { DeuceToSevenSingleDrawController } from "../DeuceToSevenSingleDrawController.js";
import { DeuceToSevenSingleDrawEngine } from "../DeuceToSevenSingleDrawEngine.js";
import { DeuceToSevenTripleDrawController } from "../DeuceToSevenTripleDrawController.js";
import { DeuceToSevenTripleDrawEngine } from "../DeuceToSevenTripleDrawEngine.js";

const variants = [
  ["D01", DeuceToSevenTripleDrawController, DeuceToSevenTripleDrawEngine],
  ["D02", AceToFiveTripleDrawController, AceToFiveTripleDrawEngine],
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

function buildAllInAfterBetState(game) {
  const state = game.createNewHandState(game.createInitialState());
  return {
    ...state.engineState,
    street: "BET",
    actingPlayerIndex: 0,
    players: state.engineState.players.map((player, seat) => ({
      ...player,
      bet: 0,
      allIn: seat === 1,
      stack: seat === 1 ? 0 : player.stack,
      folded: false,
      sittingOut: false,
      seatOut: false,
      isBusted: false,
      hasActedThisRound: true,
      hasDrawn: false,
      canDraw: true,
    })),
    metadata: {
      ...(state.engineState.metadata ?? {}),
      currentBet: 0,
      pendingDrawSeats: [],
    },
  };
}

describe("draw all-in eligibility regression", () => {
  it.each(variants)("%s selects all-in hand-eligible seats for DRAW but never for later BET", (_id, ControllerClass, EngineClass) => {
    const game = makeController(ControllerClass, EngineClass);
    const drawState = game.engine.applyBettingAction(buildAllInAfterBetState(game), {
      seatIndex: 0,
      type: "CHECK",
    });

    expect(drawState.street).toBe("DRAW");
    expect(drawState.actingPlayerIndex).toBe(1);
    expect(drawState.metadata.pendingDrawSeats).toContain(1);
    expect(drawState.players[1]).toMatchObject({ allIn: true, stack: 0, folded: false });
    expect(game.getLegalActions({ engineState: drawState }, 1)).toEqual([
      { type: "DRAW", minDiscard: 0, maxDiscard: 5 },
    ]);
    expect(game.getLegalActions({ engineState: { ...drawState, street: "BET" } }, 1)).toEqual([]);

    const afterAllInDraw = game.engine.applyDrawAction(drawState, {
      seatIndex: 1,
      type: "DRAW",
      discardIndexes: [],
    });
    const afterHeroDraw = game.engine.applyDrawAction(afterAllInDraw, {
      seatIndex: 0,
      type: "DRAW",
      discardIndexes: [],
    });

    expect(afterHeroDraw.players[1].allIn).toBe(true);
    expect(afterHeroDraw.players[1].folded).toBe(false);
    expect(afterHeroDraw.actingPlayerIndex).not.toBe(1);
    if (afterHeroDraw.street === "BET") {
      expect(game.getLegalActions({ engineState: afterHeroDraw }, 1)).toEqual([]);
    }
  });

  it.each(variants)("%s excludes folded and out seats from DRAW", (_id, ControllerClass, EngineClass) => {
    const game = makeController(ControllerClass, EngineClass);
    const state = game.createNewHandState(game.createInitialState());
    const drawState = game.engine.transitionToDraw({
      ...state.engineState,
      players: state.engineState.players.map((player, seat) => ({
        ...player,
        folded: seat === 1,
        seatOut: false,
        sittingOut: false,
        isBusted: false,
      })),
    }, 1);

    expect(drawState.metadata.pendingDrawSeats).not.toContain(1);
    expect(drawState.actingPlayerIndex).not.toBe(1);
  });
});
