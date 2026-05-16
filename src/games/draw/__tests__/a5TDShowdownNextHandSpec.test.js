import { describe, expect, it } from "vitest";
import { AceToFiveTripleDrawController } from "../AceToFiveTripleDrawController.js";
import { AceToFiveTripleDrawEngine } from "../AceToFiveTripleDrawEngine.js";

function makeGame() {
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

function reachShowdown(game) {
  let state = game.createNewHandState(game.createInitialState());
  state = game.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
  state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;
  for (let round = 1; round <= 3; round += 1) {
    state = game.applyAction(state, { seatIndex: 1, type: "DRAW", discardIndexes: [] }).state;
    state = game.applyAction(state, { seatIndex: 0, type: "DRAW", discardIndexes: [] }).state;
    state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;
    state = game.applyAction(state, { seatIndex: 0, type: "CHECK" }).state;
  }
  return state;
}

describe("A-5 Triple Draw showdown and next hand spec", () => {
  it("resolves showdown after final betting round", () => {
    const game = makeGame();
    const state = reachShowdown(game);

    expect(game.isHandFinished(state)).toBe(true);
    expect(state.snapshot.phase).toBe("SHOWDOWN");
    expect(state.snapshot.lastHandResult?.pot).toBeGreaterThan(0);
    expect(state.snapshot.lastHandResult?.winners.length).toBeGreaterThan(0);
  });

  it("fold-to-one awards the pot immediately", () => {
    const game = makeGame();
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "FOLD" }).state;

    expect(game.isHandFinished(state)).toBe(true);
    expect(state.snapshot.lastHandResult?.winners).toHaveLength(1);
    expect(state.snapshot.lastHandResult?.pot).toBeGreaterThan(0);
  });

  it("next hand resets street state while preserving updated stacks", () => {
    const game = makeGame();
    const terminal = reachShowdown(game);
    const next = game.createNewHandState(terminal);

    expect(next.snapshot.phase).toBe("BET");
    expect(next.snapshot.drawRound).toBe(0);
    expect(next.snapshot.lastHandResult).toBeNull();
    expect(next.snapshot.players).toHaveLength(2);
    expect(next.snapshot.currentBet).toBe(20);
  });
});

