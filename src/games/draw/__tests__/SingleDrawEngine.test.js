import { describe, expect, it } from "vitest";
import { getEngine, listEngines } from "../../core/engineRegistry.js";
import { getVariantProfile } from "../../config/variantProfiles.js";
import { AceToFiveSingleDrawEngine } from "../AceToFiveSingleDrawEngine.js";
import { DeuceToSevenSingleDrawEngine } from "../DeuceToSevenSingleDrawEngine.js";

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

describe("Single draw lowball engines", () => {
  it("initializes S01 as a one-draw 2-7 variant", () => {
    const engine = new DeuceToSevenSingleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });

    expect(engine.id).toBe("deuce_to_seven_single_draw");
    expect(engine.variantId).toBe("S01");
    expect(engine.maxDrawRounds).toBe(1);
    expect(state.metadata).toMatchObject({
      variantId: "S01",
      evaluator: "low-27",
      maxDrawRounds: 1,
      bigBetStartsAtDrawRound: 1,
      raiseCap: 4,
    });
  });

  it("initializes S02 as a one-draw A-5 variant", () => {
    const engine = new AceToFiveSingleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });

    expect(state.players).toHaveLength(2);
    expect(engine.id).toBe("ace_to_five_single_draw");
    expect(engine.variantId).toBe("S02");
    expect(engine.maxDrawRounds).toBe(1);
    expect(engine.evaluateShowdownHand(["AS", "2S", "3S", "4S", "5S"])).toMatchObject({
      handName: "A-5 Low 5-4-3-2-A",
      metadata: { penalty: 0 },
    });
  });

  it("uses BET -> DRAW -> BET -> SHOWDOWN with a big closing bet", () => {
    const engine = new DeuceToSevenSingleDrawEngine({
      deckManager: new FakeDeckManager([
        "7S", "5D", "4C", "3H", "2S",
        "8S", "6D", "5C", "3S", "2C",
      ]),
    });
    let state = engine.applyForcedBets(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
        structure: { sb: 10, bb: 20 },
      }),
    );

    expect(state.street).toBe("BET");
    expect(state.drawRoundIndex).toBe(0);

    state = engine.applyBettingAction(state, { seatIndex: 1, type: "CALL" });
    state = engine.applyBettingAction(state, { seatIndex: 0, type: "CHECK" });
    expect(state.street).toBe("DRAW");
    expect(state.drawRoundIndex).toBe(1);

    state = engine.applyDrawAction(state, {
      seatIndex: 1,
      type: "DRAW",
      discardIndexes: [],
    });
    state = engine.applyDrawAction(state, {
      seatIndex: 0,
      type: "DRAW",
      discardIndexes: [],
    });
    expect(state.street).toBe("BET");
    expect(state.drawRoundIndex).toBe(1);
    expect(state.metadata.betUnit).toBe(40);

    state = engine.applyBettingAction(state, { seatIndex: 1, type: "CHECK" });
    state = engine.applyBettingAction(state, { seatIndex: 0, type: "CHECK" });
    expect(state.street).toBe("SHOWDOWN");
    expect(state.isHandOver).toBe(true);
  });

  it("registers S01/S02 engines and exposes single-draw mixed metadata", () => {
    expect(listEngines()).toEqual(
      expect.arrayContaining(["deuce_to_seven_single_draw", "ace_to_five_single_draw"]),
    );
    expect(getEngine("deuce_to_seven_single_draw")).toBeInstanceOf(DeuceToSevenSingleDrawEngine);
    expect(getEngine("ace_to_five_single_draw")).toBeInstanceOf(AceToFiveSingleDrawEngine);
    expect(getVariantProfile("S01")).toMatchObject({
      id: "S01",
      category: "single-draw",
      drawRounds: 1,
      engineKey: "deuce_to_seven_single_draw",
      summary: "5 cards; 1 draw; fixed limit",
    });
    expect(getVariantProfile("S02")).toMatchObject({
      id: "S02",
      category: "single-draw",
      drawRounds: 1,
      engineKey: "ace_to_five_single_draw",
      summary: "5 cards; 1 draw; fixed limit",
    });
  });
});
