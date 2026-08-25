import { describe, expect, it } from "vitest";
import { AceToFiveTripleDrawEngine } from "../AceToFiveTripleDrawEngine.js";

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

describe("AceToFiveTripleDrawEngine", () => {
  it("initializes D02 with the shared triple-draw lowball structure", () => {
    const engine = new AceToFiveTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });

    expect(engine.id).toBe("ace_to_five_triple_draw");
    expect(engine.variantId).toBe("D02");
    expect(engine.maxDrawRounds).toBe(3);
    expect(state.gameId).toBe("ace_to_five_triple_draw");
    expect(state.players[0].hand).toHaveLength(5);
    expect(state.players[1].hand).toHaveLength(5);
    expect(state.metadata).toMatchObject({
      variantId: "D02",
      bettingStructure: "fixed-limit",
      evaluator: "low-a5",
      maxDrawRounds: 3,
    });
  });

  it("uses A-5 showdown labels where ace is low and straights/flushes are ignored", () => {
    const engine = new AceToFiveTripleDrawEngine();

    const result = engine.evaluateShowdownHand(["AS", "2S", "3S", "4S", "5S"]);

    expect(result.handName).toBe("A-5 Low 5-4-3-2-A");
    expect(result.metadata).toMatchObject({
      ranks: [5, 4, 3, 2, 1],
      penalty: 0,
    });
  });

  it("awards showdown to the A-5 wheel over a worse six-low", () => {
    const engine = new AceToFiveTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });
    state.players[0].hand = ["AS", "2S", "3S", "4S", "5S"];
    state.players[1].hand = ["6D", "4C", "3H", "2D", "AC"];
    state.pots = [{ amount: 100, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const result = engine.resolveShowdown(state);

    expect(result.summary[0].payouts).toEqual([
      expect.objectContaining({
        seatIndex: 0,
        payout: 100,
        handName: "A-5 Low 5-4-3-2-A",
        finalLowRanks: [5, 4, 3, 2, 1],
      }),
    ]);
  });

  it("does not let paired A-5 lows beat clean made lows", () => {
    const engine = new AceToFiveTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });
    state.players[0].hand = ["6D", "4C", "3H", "2D", "AC"];
    state.players[1].hand = ["AS", "AD", "5C", "4H", "2S"];
    state.pots = [{ amount: 100, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const result = engine.resolveShowdown(state);

    expect(result.summary[0].payouts).toEqual([
      expect.objectContaining({
        seatIndex: 0,
        payout: 100,
        handName: "A-5 Low 6-4-3-2-A",
      }),
    ]);
  });

  it("uses an A-5 CPU heuristic that pats made wheels", () => {
    const engine = new AceToFiveTripleDrawEngine({
      deckManager: new FakeDeckManager([
        "KS", "QS", "JS", "10S", "9S",
        "AS", "2S", "3S", "4S", "5S",
      ]),
    });
    const state = engine.transitionToDraw(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
      }),
      1,
    );
    state.actingPlayerIndex = 1;

    expect(engine.chooseCpuAction(state, 1)).toMatchObject({
      seatIndex: 1,
      type: "DRAW",
      discardIndexes: [],
      metadata: { strategy: "ruleBasedD02", pat: true, highestRank: 5 },
    });
  });

  it("delays weak late-draw folds until the final A-5 betting round", () => {
    const engine = new AceToFiveTripleDrawEngine();
    const state = engine.applyForcedBets(
      engine.initHand({
        seatConfig: ["HUMAN", "CPU"],
        startingStack: 500,
        dealerIndex: 0,
        structure: { sb: 10, bb: 20 },
      }),
    );
    state.actingPlayerIndex = 1;
    state.metadata.raiseCountThisRound = 3;
    state.metadata.currentBet = 40;
    state.players[0].bet = 40;
    state.players[1].bet = 20;
    state.players[1].hand = ["AS", "AD", "QC", "KD", "JS"];

    state.drawRoundIndex = 2;
    expect(engine.chooseCpuAction(state, 1)).toMatchObject({
      seatIndex: 1,
      type: "CALL",
      metadata: { strategy: "ruleBasedD02", drawCount: 4 },
    });

    state.drawRoundIndex = 3;
    expect(engine.chooseCpuAction(state, 1)).toMatchObject({
      seatIndex: 1,
      type: "FOLD",
      metadata: { foldReason: "weakLateDraw", drawCount: 4 },
    });
  });
});
