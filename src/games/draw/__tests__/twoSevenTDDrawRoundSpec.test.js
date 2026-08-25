import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawController } from "../DeuceToSevenTripleDrawController.js";
import { DeuceToSevenTripleDrawEngine } from "../DeuceToSevenTripleDrawEngine.js";

function drawState() {
  const game = new DeuceToSevenTripleDrawController({
    engine: new DeuceToSevenTripleDrawEngine(),
    tableConfig: {
      seatConfig: ["HUMAN", "CPU"],
      dealerIndex: 0,
      startingStack: 500,
      structure: { sb: 10, bb: 20 },
    },
  });
  let state = game.createNewHandState(game.createInitialState());
  state = game.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
  state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;
  return { game, state };
}

describe("2-7 Triple Draw draw round spec", () => {
  it("each player starts with five cards", () => {
    const { state } = drawState();

    expect(state.snapshot.players[0].hand).toHaveLength(5);
    expect(state.snapshot.players[1].hand).toHaveLength(5);
  });

  it("discard 0 is pat and discard 1-5 is valid", () => {
    const { game, state } = drawState();
    let result = game.applyAction(state, { seatIndex: 1, type: "DRAW", discardIndexes: [] });
    expect(result.events[0]).toMatchObject({ type: "drawAction", drawCount: 0 });

    result = game.applyAction(result.state, {
      seatIndex: 0,
      type: "DRAW",
      discardIndexes: [0, 1, 2, 3, 4],
    });
    expect(result.events[0]).toMatchObject({ type: "drawRoundComplete" });
    expect(result.state.snapshot.phase).toBe("BET");
  });

  it("discard count above five is rejected", () => {
    const { game, state } = drawState();
    const result = game.applyAction(state, {
      seatIndex: 1,
      type: "DRAW",
      discardIndexes: [0, 1, 2, 3, 4, 5],
    });

    expect(result.events[0]).toMatchObject({ type: "invalidAction" });
    expect(result.state).toBe(state);
  });

  it("does not create a fourth draw", () => {
    const { game } = drawState();
    let state = game.createNewHandState(game.createInitialState());
    state = game.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
    state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;

    for (let round = 1; round <= 3; round += 1) {
      expect(state.snapshot.phase).toBe("DRAW");
      expect(state.snapshot.drawRound).toBe(round);
      state = game.applyAction(state, { seatIndex: 1, type: "DRAW", discardIndexes: [] }).state;
      state = game.applyAction(state, { seatIndex: 0, type: "DRAW", discardIndexes: [] }).state;
      state = game.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;
      state = game.applyAction(state, { seatIndex: 0, type: "CHECK" }).state;
    }

    expect(state.snapshot.phase).toBe("SHOWDOWN");
    expect(state.snapshot.drawRound).toBe(3);
  });
});

