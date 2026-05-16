import { describe, expect, it } from "vitest";
import { buildSingleDrawProgressionRuleAudit } from "../auditSingleDrawProgressionRules.js";
import { AceToFiveSingleDrawController } from "../AceToFiveSingleDrawController.js";
import { AceToFiveSingleDrawEngine } from "../AceToFiveSingleDrawEngine.js";
import { DeuceToSevenSingleDrawController } from "../DeuceToSevenSingleDrawController.js";
import { DeuceToSevenSingleDrawEngine } from "../DeuceToSevenSingleDrawEngine.js";

const variants = [
  ["S01", DeuceToSevenSingleDrawController, DeuceToSevenSingleDrawEngine],
  ["S02", AceToFiveSingleDrawController, AceToFiveSingleDrawEngine],
];

function huController(ControllerClass, EngineClass) {
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

function closeHuOpeningBet(game, state) {
  state = game.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
  state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;
  return state;
}

function checkAround(game, state) {
  const first = state.snapshot.turn;
  const second = first === 0 ? 1 : 0;
  state = game.applyAction(state, { seatIndex: first, type: "CHECK" }).state;
  return game.applyAction(state, { seatIndex: second, type: "CHECK" }).state;
}

function patBoth(game, state) {
  const first = state.snapshot.turn;
  const second = first === 0 ? 1 : 0;
  state = game.applyAction(state, { seatIndex: first, type: "DRAW", discardIndexes: [] }).state;
  return game.applyAction(state, { seatIndex: second, type: "DRAW", discardIndexes: [] }).state;
}

describe("Single Draw progression spec", () => {
  it("automated focused audit passes", () => {
    const report = buildSingleDrawProgressionRuleAudit();

    expect(report.status).toBe("PASS_FOCUSED_AUDIT");
    expect(report.summary.failed).toBe(0);
  });

  it.each(variants)("%s goes pre-draw bet -> draw1 -> final bet -> showdown", (_id, ControllerClass, EngineClass) => {
    const game = huController(ControllerClass, EngineClass);
    let state = game.createNewHandState(game.createInitialState());
    const visited = [];
    const record = () => visited.push(`${state.snapshot.phase}:${state.snapshot.drawRound}`);

    record();
    state = closeHuOpeningBet(game, state);
    record();
    expect(state.snapshot.phase).toBe("DRAW");
    expect(state.snapshot.drawRound).toBe(1);

    state = patBoth(game, state);
    expect(state.snapshot.phase).toBe("BET");
    expect(state.snapshot.drawRound).toBe(1);
    state = checkAround(game, state);
    record();

    expect(game.isHandFinished(state)).toBe(true);
    expect(state.snapshot.phase).toBe("SHOWDOWN");
    expect(state.snapshot.drawRound).toBe(1);
    expect(visited).toEqual(["BET:0", "DRAW:1", "SHOWDOWN:1"]);
  });

  it.each(variants)("%s check-around closes the final betting street", (_id, ControllerClass, EngineClass) => {
    const game = huController(ControllerClass, EngineClass);
    let state = closeHuOpeningBet(game, game.createNewHandState(game.createInitialState()));
    state = patBoth(game, state);

    expect(state.snapshot.phase).toBe("BET");
    state = checkAround(game, state);

    expect(state.snapshot.phase).toBe("SHOWDOWN");
    expect(state.snapshot.drawRound).toBe(1);
  });

  it.each(variants)("%s call closes when all bets are matched", (_id, ControllerClass, EngineClass) => {
    const game = huController(ControllerClass, EngineClass);
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
    state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;

    expect(state.snapshot.phase).toBe("DRAW");
    expect(state.snapshot.drawRound).toBe(1);
  });

  it.each(variants)("%s fold-to-one ends the hand safely", (_id, ControllerClass, EngineClass) => {
    const game = huController(ControllerClass, EngineClass);
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "FOLD" }).state;

    expect(game.isHandFinished(state)).toBe(true);
    expect(state.snapshot.phase).toBe("SHOWDOWN");
    expect(state.snapshot.lastHandResult?.winners).toHaveLength(1);
  });

  it.fails.each(variants)("%s no-next-alive closes safely instead of electing an all-in draw actor", (_id, ControllerClass, EngineClass) => {
    const game = huController(ControllerClass, EngineClass);
    const state = game.createNewHandState(game.createInitialState());
    const next = {
      ...state.engineState,
      street: "BET",
      actingPlayerIndex: 0,
      players: state.engineState.players.map((player, seat) => ({
        ...player,
        bet: 0,
        allIn: seat === 1,
        stack: seat === 1 ? 0 : player.stack,
        hasActedThisRound: true,
      })),
      metadata: {
        ...(state.engineState.metadata ?? {}),
        currentBet: 0,
      },
    };

    const advanced = game.engine.applyBettingAction(next, { seatIndex: 0, type: "CHECK" });

    expect(advanced.actingPlayerIndex).not.toBe(1);
    expect(["BET", "SHOWDOWN"]).toContain(advanced.street);
  });
});
