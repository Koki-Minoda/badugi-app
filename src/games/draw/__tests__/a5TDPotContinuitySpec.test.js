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

describe("A-5 Triple Draw pot continuity spec", () => {
  it("blinds produce a nonzero pot obligation", () => {
    const game = makeGame();
    const state = game.createNewHandState(game.createInitialState());

    expect(state.snapshot.currentBet).toBe(20);
    expect(state.snapshot.players[0].bet).toBe(10);
    expect(state.snapshot.players[1].bet).toBe(20);
  });

  it("pot survives transition from pre-draw betting to draw", () => {
    const game = makeGame();
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
    state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;

    expect(state.snapshot.phase).toBe("DRAW");
    expect(state.snapshot.pot).toBeGreaterThan(0);
  });

  it("pot survives draw-to-bet transitions", () => {
    const game = makeGame();
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
    state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;
    state = game.applyAction(state, { seatIndex: 1, type: "DRAW", discardIndexes: [] }).state;
    state = game.applyAction(state, { seatIndex: 0, type: "DRAW", discardIndexes: [] }).state;

    expect(state.snapshot.phase).toBe("BET");
    expect(state.snapshot.pot).toBeGreaterThan(0);
  });

  it("new hand starts with fresh blind pot state after terminal result", () => {
    const game = makeGame();
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "FOLD" }).state;
    const next = game.createNewHandState(state);

    expect(state.snapshot.lastHandResult?.pot).toBeGreaterThan(0);
    expect(next.snapshot.phase).toBe("BET");
    expect(next.snapshot.drawRound).toBe(0);
    expect(next.snapshot.currentBet).toBe(20);
  });
});

