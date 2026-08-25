import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawController } from "../DeuceToSevenTripleDrawController.js";
import { DeuceToSevenTripleDrawEngine } from "../DeuceToSevenTripleDrawEngine.js";

class FakeDeckManager {
  constructor() {
    this.cards = [
      "7S", "5D", "4C", "3H", "2S",
      "8S", "6D", "5C", "3S", "2C",
      "9S", "7D", "6C", "4H", "3D",
      "TS", "8D", "7C", "5H", "4D",
      "JS", "9D", "8C", "6H", "5S",
      "QS", "TD", "9C", "7H", "6S",
    ];
  }

  reset() {}

  draw(count = 1) {
    return this.cards.splice(0, count);
  }
}

function createD01Controller({ dealerIndex = 4 } = {}) {
  return new DeuceToSevenTripleDrawController({
    engine: new DeuceToSevenTripleDrawEngine({ deckManager: new FakeDeckManager() }),
    tableConfig: {
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"],
      startingStack: 600,
      dealerIndex,
      structure: { sb: 10, bb: 20, ante: 0 },
    },
  });
}

describe("D01 blind posting invariant", () => {
  it("posts SB/BB atomically and records the BB contribution when Hero is BB", () => {
    const controller = createD01Controller({ dealerIndex: 4 });
    const state = controller.createNewHandState(controller.createInitialState());
    const engineState = state.engineState;

    expect(engineState.metadata.lastBlinds).toEqual({ sbIndex: 5, bbIndex: 0 });
    expect(engineState.players[5]).toMatchObject({
      stack: 590,
      bet: 10,
      totalInvested: 10,
      lastAction: "SB",
    });
    expect(engineState.players[0]).toMatchObject({
      stack: 580,
      bet: 20,
      totalInvested: 20,
      lastAction: "BB",
    });
    expect(engineState.metadata.currentBet).toBe(20);
    expect(engineState.players.reduce((sum, player) => sum + (player.bet ?? 0), 0)).toBe(30);
    expect(engineState.actingPlayerIndex).toBe(1);
  });

  it("computes BB toCall from currentBet minus the posted blind", () => {
    const controller = createD01Controller({ dealerIndex: 4 });
    const state = controller.createNewHandState(controller.createInitialState());
    const hero = state.engineState.players[0];

    expect(state.snapshot.players[0].betThisRound).toBe(20);
    expect(state.snapshot.players[0].totalInvested).toBe(20);
    expect(Math.max(0, state.snapshot.currentBet - state.snapshot.players[0].betThisRound)).toBe(0);
    expect(hero.stack).toBe(580);
  });
});
