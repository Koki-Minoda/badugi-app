import { describe, expect, it } from "vitest";
import { DeuceToSevenTripleDrawEngine } from "../DeuceToSevenTripleDrawEngine.js";

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
});
