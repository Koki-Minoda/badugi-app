import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawController } from "../DeuceToSevenTripleDrawController.js";
import { DeuceToSevenTripleDrawEngine } from "../DeuceToSevenTripleDrawEngine.js";

function makeController() {
  return new DeuceToSevenTripleDrawController({
    engine: new DeuceToSevenTripleDrawEngine(),
    tableConfig: {
      seatConfig: ["HUMAN", "CPU", "CPU"],
      dealerIndex: 0,
      startingStack: 500,
      structure: { sb: 10, bb: 20 },
    },
  });
}

describe("draw lowball fold-to-one collect terminal path", () => {
  it("awards the pot, clears actor, and exposes terminal result when all opponents fold", () => {
    const controller = makeController();
    let state = controller.createNewHandState(controller.createInitialState());

    while (!controller.isHandFinished(state)) {
      const actor = state.snapshot.turn;
      expect(typeof actor).toBe("number");
      const action = actor === 0 ? { type: "CALL" } : { type: "FOLD" };
      state = controller.applyAction(state, { seatIndex: actor, ...action }).state;
    }

    expect(controller.isHandFinished(state)).toBe(true);
    expect(state.snapshot.phase).toBe("SHOWDOWN");
    expect(state.snapshot.turn).toBeNull();
    expect(state.snapshot.nextTurn).toBeNull();
    expect(state.snapshot.currentActor).toBeNull();
    expect(state.snapshot.actingPlayerIndex).toBeNull();
    expect(state.snapshot.lastHandResult?.winners).toHaveLength(1);
    expect(state.snapshot.lastHandResult?.winners[0].seatIndex).toBe(0);
    expect(state.snapshot.lastHandResult?.pot).toBeGreaterThan(0);
    expect(state.snapshot.players[0].lastAction).toMatch(/^Collect /);
    expect(state.snapshot.pot).toBe(0);
  });
});
