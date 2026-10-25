import { describe, expect, it } from "vitest";
import { getEngine } from "../../core/engineRegistry.js";
import {
  ArchieTripleDrawEngine,
  BadaceySingleDrawEngine,
  BadaceyTripleDrawEngine,
  BadeuceySingleDrawEngine,
  BadeuceyTripleDrawEngine,
  BadugiSingleDrawEngine,
  HidugiSingleDrawEngine,
  HidugiTripleDrawEngine,
} from "../SpecialDrawEngine.js";

describe("special draw engines", () => {
  it.each([
    ["D04", new BadeuceyTripleDrawEngine(), 5, 3],
    ["D05", new BadaceyTripleDrawEngine(), 5, 3],
    ["D06", new HidugiTripleDrawEngine(), 4, 3],
    ["D07", new ArchieTripleDrawEngine(), 5, 3],
    ["S04", new BadugiSingleDrawEngine(), 4, 1],
    ["S05", new BadeuceySingleDrawEngine(), 5, 1],
    ["S06", new BadaceySingleDrawEngine(), 5, 1],
    ["S07", new HidugiSingleDrawEngine(), 4, 1],
  ])("initializes %s with expected deal and draw count", (variantId, engine, handCardCount, maxDrawRounds) => {
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });

    expect(engine.variantId).toBe(variantId);
    expect(engine.handCardCount).toBe(handCardCount);
    expect(engine.maxDrawRounds).toBe(maxDrawRounds);
    expect(state.players[0].hand).toHaveLength(handCardCount);
    expect(state.metadata).toMatchObject({
      variantId,
      maxDrawRounds,
      handCardCount,
    });
  });

  it("splits Badeucey pots into Badugi and 2-7 components", () => {
    const engine = new BadeuceyTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 0,
      dealerIndex: 0,
    });
    state.players[0] = {
      ...state.players[0],
      hand: ["7S", "5D", "4C", "3H", "2S"],
      stack: 0,
      totalInvested: 50,
    };
    state.players[1] = {
      ...state.players[1],
      hand: ["KS", "KD", "QC", "QH", "9S"],
      stack: 0,
      totalInvested: 50,
    };
    state.pots = [{ amount: 100, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const result = engine.resolveShowdown(state);

    expect(result.totalPot).toBe(100);
    expect(result.summary.map((entry) => entry.component)).toEqual(["badugi", "low27"]);
    expect(result.summary[0].payouts[0]).toMatchObject({ seatIndex: 0, payout: 50 });
    expect(result.summary[1].payouts[0]).toMatchObject({ seatIndex: 0, payout: 50 });
    expect(result.state.players[0].stack + result.state.players[1].stack).toBe(100);
  });

  it("scoops Badacey and returns the winner's unmatched extra chip", () => {
    const engine = new BadaceySingleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 0,
      dealerIndex: 0,
    });
    state.players[0] = {
      ...state.players[0],
      hand: ["AS", "2D", "3C", "4H", "5S"],
      stack: 0,
      totalInvested: 51,
    };
    state.players[1] = {
      ...state.players[1],
      hand: ["KS", "KD", "QC", "QH", "9S"],
      stack: 0,
      totalInvested: 50,
    };
    state.pots = [{ amount: 101, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const result = engine.resolveShowdown(state);

    expect(result.summary).toHaveLength(4);
    expect(result.summary[0]).toMatchObject({
      component: "badugi",
      componentLabel: "Badugi half",
      oddChipAmount: 0,
      eligibleSeatIndexes: [0, 1],
    });
    expect(result.summary[1]).toMatchObject({
      component: "lowA5",
      componentLabel: "A-5 Low half",
      oddChipAmount: 0,
      eligibleSeatIndexes: [0, 1],
    });
    expect(result.summary[0].payouts[0]).toMatchObject({ seatIndex: 0, payout: 50 });
    expect(result.summary[0].payouts[0]).toMatchObject({ componentLabel: "Badugi half" });
    expect(result.summary[1].payouts[0]).toMatchObject({ seatIndex: 0, payout: 50 });
    expect(result.summary[1].payouts[0]).toMatchObject({ componentLabel: "A-5 Low half" });
    expect(result.summary[2]).toMatchObject({ component: "badugi", potAmount: 0, oddChipAmount: 0 });
    expect(result.summary[3]).toMatchObject({ component: "lowA5", potAmount: 1, oddChipAmount: 1, eligibleSeatIndexes: [0] });
    expect(result.summary[3].payouts[0]).toMatchObject({ seatIndex: 0, payout: 1 });
    expect(result.state.players[0].stack).toBe(101);
  });

  it("scoops Archie high half when no 8-or-better low qualifies", () => {
    const engine = new ArchieTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 0,
      dealerIndex: 0,
    });
    state.players[0] = {
      ...state.players[0],
      hand: ["AS", "AH", "KD", "QC", "9S"],
      stack: 0,
      totalInvested: 50,
    };
    state.players[1] = {
      ...state.players[1],
      hand: ["KS", "QH", "JD", "9C", "8S"],
      stack: 0,
      totalInvested: 50,
    };
    state.pots = [{ amount: 100, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const result = engine.resolveShowdown(state);

    expect(result.summary).toHaveLength(2);
    expect(result.summary[0]).toMatchObject({ component: "archieHigh", potAmount: 100 });
    expect(result.summary[0].payouts[0]).toMatchObject({ seatIndex: 0, payout: 100 });
    expect(result.summary[1]).toMatchObject({ component: "archieLow", potAmount: 0, payouts: [] });
    expect(result.state.players[0].stack + result.state.players[1].stack).toBe(100);
  });

  it("scoops Archie low half when no pair-or-better high qualifies", () => {
    const engine = new ArchieTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 0,
      dealerIndex: 0,
    });
    state.players[0] = {
      ...state.players[0],
      hand: ["AS", "2D", "3C", "4H", "7S"],
      stack: 0,
      totalInvested: 50,
    };
    state.players[1] = {
      ...state.players[1],
      hand: ["KS", "QH", "JD", "9C", "8S"],
      stack: 0,
      totalInvested: 50,
    };
    state.pots = [{ amount: 100, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const result = engine.resolveShowdown(state);

    expect(result.summary).toHaveLength(2);
    expect(result.summary[0]).toMatchObject({ component: "archieHigh", potAmount: 0, payouts: [] });
    expect(result.summary[1]).toMatchObject({ component: "archieLow", potAmount: 100 });
    expect(result.summary[1].payouts[0]).toMatchObject({ seatIndex: 0, payout: 100 });
    expect(result.state.players[0].stack + result.state.players[1].stack).toBe(100);
  });

  it("keeps Archie accounting stable when no component qualifies", () => {
    const engine = new ArchieTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 0,
      dealerIndex: 0,
    });
    state.players[0] = {
      ...state.players[0],
      hand: ["AS", "KH", "QD", "JC", "9S"],
      stack: 0,
      totalInvested: 51,
    };
    state.players[1] = {
      ...state.players[1],
      hand: ["KS", "QH", "JD", "9C", "8S"],
      stack: 0,
      totalInvested: 50,
    };
    state.pots = [{ amount: 101, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const result = engine.resolveShowdown(state);

    expect(result.summary).toHaveLength(4);
    expect(result.summary.reduce((sum, pot) => sum + pot.potAmount, 0)).toBe(101);
    expect(result.state.players[0].stack + result.state.players[1].stack).toBe(101);
  });

  it("registers all special draw engines", () => {
    expect(getEngine("badeucey_triple_draw").variantId).toBe("D04");
    expect(getEngine("badacey_triple_draw").variantId).toBe("D05");
    expect(getEngine("hidugi_triple_draw").variantId).toBe("D06");
    expect(getEngine("archie_triple_draw").variantId).toBe("D07");
    expect(getEngine("badugi_single_draw").variantId).toBe("S04");
    expect(getEngine("badeucey_single_draw").variantId).toBe("S05");
    expect(getEngine("badacey_single_draw").variantId).toBe("S06");
    expect(getEngine("hidugi_single_draw").variantId).toBe("S07");
  });

  it.each([
    [BadeuceySingleDrawEngine, ["7S", "5D", "4C", "3H", "2S"]],
    [BadaceySingleDrawEngine, ["AS", "2D", "3C", "4H", "5S"]],
  ])("keeps a premium five-card low in %p instead of breaking it for a draw", (Engine, hand) => {
    const engine = new Engine();
    const state = engine.initHand({ seatConfig: ["HUMAN", "CPU"], startingStack: 500, dealerIndex: 0 });
    state.players[1].hand = hand;
    state.street = "DRAW";
    state.actingPlayerIndex = 1;

    expect(engine.chooseCpuAction(state, 1)).toMatchObject({ type: "DRAW", discardIndexes: [] });
  });

  it("uses ace-high Badugi when Badeucey CPU must choose between an ace and king", () => {
    const engine = new BadeuceySingleDrawEngine();
    const state = engine.initHand({ seatConfig: ["HUMAN", "CPU"], startingStack: 500, dealerIndex: 0 });
    state.players[1].hand = ["AS", "2D", "3C", "4H", "KS"];
    state.street = "DRAW";
    state.actingPlayerIndex = 1;

    expect(engine.chooseCpuAction(state, 1)).toMatchObject({ type: "DRAW", discardIndexes: [0] });
  });

  it.each([
    [BadeuceySingleDrawEngine, ["2S", "3D", "4C", "6H", "KS"], ["8S", "7D", "5C", "4H", "2C"]],
    [BadaceySingleDrawEngine, ["AS", "2D", "3C", "4H", "KS"], ["8S", "5D", "4C", "3H", "2S"]],
  ])("splits %p single-draw pots between its Badugi and five-card low winners", (Engine, badugiHand, lowHand) => {
    const engine = new Engine();
    const state = engine.initHand({ seatConfig: ["HUMAN", "CPU"], startingStack: 0, dealerIndex: 0 });
    state.players[0] = { ...state.players[0], hand: badugiHand, stack: 0, totalInvested: 51 };
    state.players[1] = { ...state.players[1], hand: lowHand, stack: 0, totalInvested: 50 };
    state.pots = [{ amount: 101, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const result = engine.resolveShowdown(state);

    expect(result.totalPot).toBe(101);
    expect(result.summary.slice(0, 2).map(({ component, potAmount, payouts }) => ({
      component,
      potAmount,
      winners: payouts.map(({ seatIndex }) => seatIndex),
    }))).toEqual([
      { component: "badugi", potAmount: 50, winners: [0] },
      { component: engine.specialConfig.split.components[1], potAmount: 50, winners: [1] },
    ]);
    expect(result.summary.slice(2).map(({ potAmount, payouts }) => ({
      potAmount,
      winners: payouts.map(({ seatIndex }) => seatIndex),
    }))).toEqual([{ potAmount: 0, winners: [] }, { potAmount: 1, winners: [0] }]);
    expect(result.state.players[0].stack + result.state.players[1].stack).toBe(101);
  });
});
