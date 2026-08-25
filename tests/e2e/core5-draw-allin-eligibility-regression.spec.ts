import { expect, test } from "@playwright/test";
import { AceToFiveSingleDrawController } from "../../src/games/draw/AceToFiveSingleDrawController.js";
import { AceToFiveSingleDrawEngine } from "../../src/games/draw/AceToFiveSingleDrawEngine.js";
import { AceToFiveTripleDrawController } from "../../src/games/draw/AceToFiveTripleDrawController.js";
import { AceToFiveTripleDrawEngine } from "../../src/games/draw/AceToFiveTripleDrawEngine.js";
import { DeuceToSevenSingleDrawController } from "../../src/games/draw/DeuceToSevenSingleDrawController.js";
import { DeuceToSevenSingleDrawEngine } from "../../src/games/draw/DeuceToSevenSingleDrawEngine.js";
import { DeuceToSevenTripleDrawController } from "../../src/games/draw/DeuceToSevenTripleDrawController.js";
import { DeuceToSevenTripleDrawEngine } from "../../src/games/draw/DeuceToSevenTripleDrawEngine.js";

const variants = [
  ["D01", DeuceToSevenTripleDrawController, DeuceToSevenTripleDrawEngine],
  ["D02", AceToFiveTripleDrawController, AceToFiveTripleDrawEngine],
  ["S01", DeuceToSevenSingleDrawController, DeuceToSevenSingleDrawEngine],
  ["S02", AceToFiveSingleDrawController, AceToFiveSingleDrawEngine],
] as const;

function makeController(ControllerClass: any, EngineClass: any) {
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

function buildAllInAfterBetState(game: any) {
  const state = game.createNewHandState(game.createInitialState());
  return {
    ...state.engineState,
    street: "BET",
    actingPlayerIndex: 0,
    players: state.engineState.players.map((player: any, seat: number) => ({
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

test.describe("Core5 draw all-in eligibility regression", () => {
  for (const [variantId, ControllerClass, EngineClass] of variants) {
    test(`${variantId} keeps all-in seats draw-eligible but bet-ineligible`, async () => {
      const game = makeController(ControllerClass, EngineClass);
      const drawState = game.engine.applyBettingAction(buildAllInAfterBetState(game), {
        seatIndex: 0,
        type: "CHECK",
      });

      expect(drawState.street).toBe("DRAW");
      expect(drawState.actingPlayerIndex).toBe(1);
      expect(game.getLegalActions({ engineState: drawState }, 1)).toEqual([
        { type: "DRAW", minDiscard: 0, maxDiscard: 5 },
      ]);

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
      expect(game.getLegalActions({ engineState: { ...afterHeroDraw, street: "BET" } }, 1)).toEqual([]);
    });
  }
});
