import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawController } from "../DeuceToSevenTripleDrawController.js";
import { DeuceToSevenTripleDrawEngine } from "../DeuceToSevenTripleDrawEngine.js";

class FakeDeckManager {
  constructor(cards = []) {
    this.cards = [...cards];
    this.discardPile = [];
  }

  reset() {}

  draw(count = 1) {
    return this.cards.splice(0, count);
  }

  discard(cards = []) {
    this.discardPile.push(...cards);
  }
}

function buildController() {
  return new DeuceToSevenTripleDrawController({
    engine: new DeuceToSevenTripleDrawEngine({
      deckManager: new FakeDeckManager([
        "7S", "5D", "4C", "3H", "2S",
        "8S", "6D", "5C", "3S", "2C",
        "KS", "QS", "JS", "10S", "9S",
      ]),
    }),
    tableConfig: {
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
      structure: { sb: 10, bb: 20 },
    },
  });
}

function chooseDeterministicAction(controller, state) {
  const seatIndex = state.snapshot.turn;
  const actions = controller.getLegalActions(state, seatIndex);
  if (state.snapshot.phase === "DRAW") {
    return { seatIndex, payload: { type: "DRAW", discardIndexes: [] } };
  }
  if (actions.some((action) => action.type === "CHECK")) {
    return { seatIndex, type: "CHECK" };
  }
  if (actions.some((action) => action.type === "CALL")) {
    return { seatIndex, type: "CALL" };
  }
  throw new Error(`No deterministic action for phase=${state.snapshot.phase} seat=${seatIndex}`);
}

describe("D01 2-7 Triple Draw e2e hand flow", () => {
  it("plays one controller hand from blinds through showdown", () => {
    const controller = buildController();
    let state = controller.createNewHandState(controller.createInitialState());
    const events = [...state.lastEvents];

    for (let step = 0; step < 40 && !controller.isHandFinished(state); step += 1) {
      const result = controller.applyAction(state, chooseDeterministicAction(controller, state));
      events.push(...result.events);
      state = result.state;
    }

    expect(controller.isHandFinished(state)).toBe(true);
    expect(state.snapshot).toMatchObject({
      variantId: "D01",
      phase: "SHOWDOWN",
      drawRound: 3,
      maxDiscardCount: 5,
      handCardCount: 5,
    });
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["handStarted", "betRoundComplete", "drawRoundComplete", "handComplete"]),
    );
    expect(state.snapshot.lastHandResult).toMatchObject({
      pot: 40,
      winners: [expect.objectContaining({ seatIndex: 0, payout: 40 })],
    });
    expect(controller.getWinners(state)[0]).toMatchObject({
      seatIndex: 0,
      handLabel: "2-7 Low 7-5-4-3-2",
    });
    expect(state.snapshot.players.reduce((sum, player) => sum + player.stack, 0)).toBe(1000);
    expect(state.snapshot.players.every((player) => player.hand.length === 5)).toBe(true);
  });
});
