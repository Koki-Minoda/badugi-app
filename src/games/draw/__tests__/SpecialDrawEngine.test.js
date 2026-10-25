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

  it.each([HidugiTripleDrawEngine, HidugiSingleDrawEngine])("awards Hidugi to four aces in %s", (Engine) => {
    const engine = new Engine();
    const state = engine.initHand({ seatConfig: ["HUMAN", "CPU"], startingStack: 0, dealerIndex: 0 });
    state.players[0] = { ...state.players[0], hand: ["AS", "AH", "AD", "AC"], stack: 0, totalInvested: 50 };
    state.players[1] = { ...state.players[1], hand: ["KS", "KH", "KD", "KC"], stack: 0, totalInvested: 50 };
    state.pots = [{ amount: 100, eligiblePlayerIds: ["seat-0", "seat-1"] }];

    const result = engine.resolveShowdown(state);
    expect(result.state.players[0].stack).toBe(100);
    expect(result.state.players[1].stack).toBe(0);
    expect(result.summary[0].payouts[0]).toMatchObject({ seatIndex: 0, payout: 100 });
  });

  it.each([HidugiTripleDrawEngine, HidugiSingleDrawEngine])("draws toward high Hidugi rather than low Badugi in %s", (Engine) => {
    const engine = new Engine();
    const state = engine.initHand({ seatConfig: ["HUMAN", "CPU"], startingStack: 500, dealerIndex: 0 });
    state.street = "DRAW";
    state.actingPlayerIndex = 1;
    state.players[1].hand = ["AS", "AH", "AD", "AC"];
    expect(engine.chooseCpuAction(state, 1).discardIndexes).toEqual([]);

    state.players[1].hand = ["AS", "AH", "AD", "2C"];
    expect(engine.chooseCpuAction(state, 1).discardIndexes)
      .toEqual(Engine === HidugiSingleDrawEngine ? [] : [3]);

    state.players[1].hand = ["AS", "KS", "QH", "JD"];
    expect(engine.chooseCpuAction(state, 1).discardIndexes).toEqual([1]);
  });

  it("stands pat with a complete four-card Hidugi when there is only one draw", () => {
    const engine = new HidugiSingleDrawEngine();
    const state = engine.initHand({ seatConfig: ["HUMAN", "CPU"], startingStack: 500, dealerIndex: 0 });
    state.street = "DRAW";
    state.actingPlayerIndex = 1;
    state.players[1].hand = ["AS", "KH", "QD", "2C"];

    expect(engine.chooseCpuAction(state, 1).discardIndexes).toEqual([]);
    expect(new HidugiTripleDrawEngine().chooseCpuAction(state, 1).discardIndexes).toEqual([3]);
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

  it("splits Archie pots among remaining players when no component qualifies", () => {
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

    expect(result.summary).toHaveLength(2);
    expect(result.summary.every((pot) => pot.component === "archieChop")).toBe(true);
    expect(result.summary.reduce((sum, pot) => sum + pot.potAmount, 0)).toBe(101);
    expect(result.summary[0].payouts.map((payout) => payout.payout)).toEqual([50, 50]);
    expect(result.summary[1].payouts.map((payout) => payout.payout)).toEqual([1]);
    expect(result.state.players.map((player) => player.stack)).toEqual([51, 50]);
  });

  it("awards an odd unqualified Archie chip clockwise from the button", () => {
    const engine = new ArchieTripleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 0,
      dealerIndex: 0,
    });
    const hands = [
      ["AS", "KH", "QD", "JC", "9S"],
      ["KS", "QH", "JD", "9C", "8S"],
      ["QS", "JH", "9D", "8C", "7S"],
    ];
    state.players = state.players.map((player, index) => ({
      ...player, hand: hands[index], stack: 0, totalInvested: 0,
    }));
    state.pots = [{ amount: 101, eligiblePlayerIds: state.players.map((player) => player.playerId) }];

    const result = engine.resolveShowdown(state);

    expect(result.summary).toHaveLength(1);
    expect(result.summary[0].component).toBe("archieChop");
    expect(result.summary[0].payouts.map(({ seatIndex, payout }) => [seatIndex, payout])).toEqual([
      [1, 34], [2, 34], [0, 33],
    ]);
    expect(result.state.players.map((player) => player.stack)).toEqual([33, 34, 34]);
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

  it("stands pat with a four-card Badugi in the single-draw game", () => {
    const engine = new BadugiSingleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });
    // The shared triple-draw heuristic discarded the last card (the ace) from
    // this king-high Badugi, reducing a made four-card hand to a draw.
    state.players[1].hand = ["KS", "9H", "4D", "AC"];
    state.street = "DRAW";
    state.actingPlayerIndex = 1;

    expect(engine.chooseCpuAction(state, 1)).toMatchObject({
      type: "DRAW",
      discardIndexes: [],
    });
  });

  it("settles Badugi Single Draw main and side pots by eligible hands", () => {
    const engine = new BadugiSingleDrawEngine();
    const state = engine.initHand({
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 500,
      dealerIndex: 0,
    });
    state.players[0].hand = ["AS", "2D", "3C", "4H"];
    state.players[1].hand = ["8S", "7D", "6C", "AH"];
    state.players[2].hand = ["KS", "KH", "4D", "AC"];
    state.pots = [
      { amount: 90, eligiblePlayerIds: ["seat-0", "seat-1", "seat-2"] },
      { amount: 40, eligiblePlayerIds: ["seat-1", "seat-2"] },
    ];

    const result = engine.resolveShowdown(state);

    expect(result.totalPot).toBe(130);
    expect(result.summary.map((pot) => pot.payouts.map(({ seatIndex, payout }) => ({ seatIndex, payout })))).toEqual([
      [{ seatIndex: 0, payout: 90 }],
      [{ seatIndex: 1, payout: 40 }],
    ]);
    expect(result.summary[0].payouts[0].ranksLabel).toBe("A-2-3-4");
    expect(result.summary[1].payouts[0].ranksLabel).toBe("A-6-7-8");
    expect(result.state.players.map(({ stack }) => stack)).toEqual([590, 540, 500]);
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
