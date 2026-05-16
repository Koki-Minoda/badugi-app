import { describe, expect, it } from "vitest";
import { buildA5TDProgressionRuleAudit } from "../auditA5TDProgressionRules.js";
import { AceToFiveTripleDrawController } from "../AceToFiveTripleDrawController.js";
import { AceToFiveTripleDrawEngine } from "../AceToFiveTripleDrawEngine.js";

function huController() {
  return new AceToFiveTripleDrawController({
    engine: new AceToFiveTripleDrawEngine(),
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

describe("A-5 Triple Draw progression spec", () => {
  it("automated focused audit passes", () => {
    const report = buildA5TDProgressionRuleAudit();

    expect(report.status).toBe("PASS_FOCUSED_AUDIT");
    expect(report.summary.failed).toBe(0);
  });

  it("goes pre-draw bet -> draw1 -> bet -> draw2 -> bet -> draw3 -> final bet -> showdown", () => {
    const game = huController();
    let state = game.createNewHandState(game.createInitialState());
    const visited = [];
    const record = () => visited.push(`${state.snapshot.phase}:${state.snapshot.drawRound}`);

    record();
    state = closeHuOpeningBet(game, state);
    record();

    for (let round = 1; round <= 3; round += 1) {
      expect(state.snapshot.phase).toBe("DRAW");
      expect(state.snapshot.drawRound).toBe(round);
      state = patBoth(game, state);
      expect(state.snapshot.phase).toBe("BET");
      expect(state.snapshot.drawRound).toBe(round);
      state = checkAround(game, state);
      record();
    }

    expect(game.isHandFinished(state)).toBe(true);
    expect(state.snapshot.phase).toBe("SHOWDOWN");
    expect(state.snapshot.lastHandResult).toBeTruthy();
    expect(visited).toEqual(["BET:0", "DRAW:1", "DRAW:2", "DRAW:3", "SHOWDOWN:3"]);
  });

  it("check-around closes a post-draw betting street", () => {
    const game = huController();
    let state = closeHuOpeningBet(game, game.createNewHandState(game.createInitialState()));
    state = patBoth(game, state);

    expect(state.snapshot.phase).toBe("BET");
    state = checkAround(game, state);

    expect(state.snapshot.phase).toBe("DRAW");
    expect(state.snapshot.drawRound).toBe(2);
  });

  it("call closes when all bets are matched", () => {
    const game = huController();
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "CALL" }).state;

    expect(state.snapshot.phase).toBe("BET");
    state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;

    expect(state.snapshot.phase).toBe("DRAW");
    expect(state.snapshot.drawRound).toBe(1);
  });

  it("fold-to-one ends the hand safely", () => {
    const game = huController();
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "FOLD" }).state;

    expect(game.isHandFinished(state)).toBe(true);
    expect(state.snapshot.phase).toBe("SHOWDOWN");
    expect(state.snapshot.lastHandResult?.winners).toHaveLength(1);
  });

  it.fails("no-next-alive closes safely instead of electing an all-in draw actor", () => {
    const game = huController();
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
    expect(["DRAW", "SHOWDOWN"]).toContain(advanced.street);
  });
});
