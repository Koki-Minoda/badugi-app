import { describe, expect, it } from "vitest";
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

function allCards(players) {
  return players.flatMap((player) => player.hand ?? []);
}

describe("DeuceToSevenTripleDrawEngine", () => {
  it("initializes D01 with five cards and three draw rounds", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.initHand({
      handId: "d01-hand-1",
      seatConfig: ["HUMAN", "CPU", "CPU", "EMPTY"],
      startingStack: 500,
      dealerIndex: 0,
      structure: { sb: 10, bb: 20 },
    });

    expect(engine.id).toBe("deuce_to_seven_triple_draw");
    expect(engine.variantId).toBe("D01");
    expect(engine.maxDrawRounds).toBe(3);
    expect(state.gameId).toBe("deuce_to_seven_triple_draw");
    expect(state.street).toBe("BET");
    expect(state.drawRoundIndex).toBe(0);
    expect(state.players[0].hand).toHaveLength(5);
    expect(state.players[1].hand).toHaveLength(5);
    expect(state.players[2].hand).toHaveLength(5);
    expect(state.players[3].hand).toHaveLength(0);
    expect(new Set(allCards(state.players)).size).toBe(15);
    expect(state.metadata).toMatchObject({
      variantId: "D01",
      bettingStructure: "fixed-limit",
      evaluator: "low-27",
      maxDrawRounds: 3,
      raiseCap: 4,
    });
  });

  it("applies blinds using the draw base forced-bet path", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
      structure: { sb: 10, bb: 20 },
    });

    const withBlinds = engine.applyForcedBets(state);

    expect(withBlinds.players[0]).toMatchObject({ stack: 500, bet: 0 });
    expect(withBlinds.players[1]).toMatchObject({ stack: 490, bet: 10, lastAction: "SB" });
    expect(withBlinds.players[2]).toMatchObject({ stack: 480, bet: 20, lastAction: "BB" });
    expect(withBlinds.metadata.currentBet).toBe(20);
  });

  it("formats 2-7 showdown labels from the evaluator", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const result = engine.evaluateShowdownHand(["7S", "5D", "4C", "3H", "2S"]);

    expect(result.handName).toBe("2-7 Low 7-5-4-3-2");
    expect(result.metadata.ranks).toEqual([7, 5, 4, 3, 2]);
  });

  it("advances from an opening bet round into draw round 1", () => {
    const engine = new DeuceToSevenTripleDrawEngine({
      deckManager: new FakeDeckManager([
        "2S", "3S", "4S", "5S", "7S",
        "2H", "3H", "4H", "5H", "8H",
        "2D", "3D", "4D", "5D", "9D",
      ]),
    });
    const state = engine.applyForcedBets(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
        structure: { sb: 10, bb: 20 },
      }),
    );

    const drawState = engine.advanceAfterBet(state);

    expect(drawState.street).toBe("DRAW");
    expect(drawState.drawRoundIndex).toBe(1);
    expect(drawState.pots[0]).toMatchObject({ amount: 30 });
    expect(drawState.players.map((player) => player.bet)).toEqual([0, 0, 0]);
    expect(drawState.metadata.pendingDrawSeats).toEqual([0, 1, 2]);
    expect(drawState.actingPlayerIndex).toBe(1);
  });

  it("replaces discarded cards and returns to betting after all active seats draw", () => {
    const deckManager = new FakeDeckManager([
      "2S", "3S", "4S", "5S", "7S",
      "2H", "3H", "4H", "5H", "8H",
      "9S", "10S", "JS",
    ]);
    const engine = new DeuceToSevenTripleDrawEngine({ deckManager });
    const drawState = engine.transitionToDraw(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
      }),
      1,
    );

    const afterHero = engine.applyDrawAction(drawState, {
      seatIndex: 1,
      type: "DRAW",
      discardIndexes: [3, 4],
    });
    expect(afterHero.street).toBe("DRAW");
    expect(afterHero.players[1].hand).toEqual(["2H", "3H", "4H", "9S", "10S"]);
    expect(afterHero.players[1].lastAction).toBe("DRAW(2)");
    expect(afterHero.metadata.discardCountBySeat[1]).toBe(2);
    expect(deckManager.discardPile).toEqual(["5H", "8H"]);
    expect(afterHero.actingPlayerIndex).toBe(0);

    const afterCpu = engine.applyDrawAction(afterHero, {
      seatIndex: 0,
      type: "DRAW",
      discardIndexes: [],
    });
    expect(afterCpu.street).toBe("BET");
    expect(afterCpu.drawRoundIndex).toBe(1);
    expect(afterCpu.players[0].lastAction).toBe("Pat");
    expect(afterCpu.metadata.pendingDrawSeats).toEqual([]);
    expect(afterCpu.metadata.discardCountBySeat[0]).toBe(0);
  });

  it("moves to showdown after the third post-draw betting round", () => {
    const engine = new DeuceToSevenTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });
    state.drawRoundIndex = 3;
    state.players[0].bet = 20;
    state.players[1].bet = 20;

    const showdownState = engine.advanceAfterBet(state);

    expect(showdownState.street).toBe("SHOWDOWN");
    expect(showdownState.isHandOver).toBe(true);
    expect(showdownState.pots[0]).toMatchObject({ amount: 40 });
    expect(showdownState.actingPlayerIndex).toBeNull();
  });
});
