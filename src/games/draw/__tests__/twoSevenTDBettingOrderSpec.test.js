import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawController } from "../DeuceToSevenTripleDrawController.js";
import { DeuceToSevenTripleDrawEngine } from "../DeuceToSevenTripleDrawEngine.js";

function controller({ seatConfig, dealerIndex = 0 } = {}) {
  return new DeuceToSevenTripleDrawController({
    engine: new DeuceToSevenTripleDrawEngine(),
    tableConfig: {
      seatConfig,
      dealerIndex,
      startingStack: 500,
      structure: { sb: 10, bb: 20 },
    },
  });
}

function newHand(opts) {
  const game = controller(opts);
  return { game, state: game.createNewHandState(game.createInitialState()) };
}

describe("2-7 Triple Draw betting order spec", () => {
  it("6max pre-draw first actor is UTG left of BB, not BB", () => {
    const { state } = newHand({
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"],
      dealerIndex: 0,
    });

    expect(state.snapshot.metadata.lastBlinds).toMatchObject({ sbIndex: 1, bbIndex: 2 });
    expect(state.snapshot.turn).toBe(3);
    expect(state.snapshot.turn).not.toBe(state.snapshot.metadata.lastBlinds.bbIndex);
  });

  it("3way pre-draw first actor is UTG left of BB, not BB", () => {
    const { state } = newHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      dealerIndex: 0,
    });

    expect(state.snapshot.metadata.lastBlinds).toMatchObject({ sbIndex: 1, bbIndex: 2 });
    expect(state.snapshot.turn).toBe(0);
    expect(state.snapshot.turn).not.toBe(state.snapshot.metadata.lastBlinds.bbIndex);
  });

  it("heads-up pre-draw first actor is BTN/SB", () => {
    const { state } = newHand({
      seatConfig: ["HUMAN", "CPU"],
      dealerIndex: 0,
    });

    expect(state.snapshot.metadata.lastBlinds).toMatchObject({ sbIndex: 0, bbIndex: 1 });
    expect(state.snapshot.turn).toBe(0);
  });

  it("post-draw first actor is first active left of the button", () => {
    const { game, state } = newHand({
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU"],
      dealerIndex: 0,
    });
    const drawState = game.engine.transitionToDraw(state.engineState, 1);
    const betState = game.engine.transitionToBet(drawState);

    expect(betState.street).toBe("BET");
    expect(betState.actingPlayerIndex).toBe(1);
  });

  it("post-draw first actor skips folded and all-in seats", () => {
    const { game, state } = newHand({
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU"],
      dealerIndex: 0,
    });
    let drawState = game.engine.transitionToDraw(state.engineState, 1);
    drawState.players[1] = { ...drawState.players[1], folded: true };
    drawState.players[2] = { ...drawState.players[2], allIn: true, stack: 0 };
    const betState = game.engine.transitionToBet(drawState);

    expect(betState.actingPlayerIndex).toBe(3);
  });
});

