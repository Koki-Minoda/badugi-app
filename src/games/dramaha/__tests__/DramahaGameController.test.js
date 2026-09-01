import { describe, expect, it } from "vitest";
import DramahaGameController from "../DramahaGameController.js";

class StubDeck {
  constructor(cards = []) {
    this.cards = [...cards];
  }

  draw(n) {
    return this.cards.splice(0, n);
  }
}

function createController({
  seats = [
    { name: "Hero", stack: 1000 },
    { name: "CPU 1", stack: 1000 },
    { name: "CPU 2", stack: 1000 },
  ],
  deckCards = [],
  blinds = { sb: 10, bb: 20, ante: 0 },
  variant = "dramaha_hi",
} = {}) {
  return new DramahaGameController({
    variant,
    tableConfig: { seats, blinds },
    deckFactory: () => new StubDeck(deckCards),
  });
}

const STARTING_DECK = [
  "AS", "KS", "QS",
  "AD", "KD", "QD",
  "AC", "KC", "QC",
  "AH", "KH", "QH",
  "2S", "3S", "4S",
  "5S", "6S", "7S",
  "8S", "9S", "10S",
  "JS", "2H", "3H",
  "4C", "5C", "6C", "7C", "8C", "9C", "10C", "JC",
];

describe("DramahaGameController", () => {
  it("deals five hole cards and posts blinds", () => {
    const controller = createController({ deckCards: STARTING_DECK });
    const snapshot = controller.startNewHand();

    snapshot.players.forEach((player) => {
      expect(player.holeCards).toHaveLength(5);
    });
    expect(snapshot.players[snapshot.smallBlindIndex].betThisStreet).toBe(10);
    expect(snapshot.players[snapshot.bigBlindIndex].betThisStreet).toBe(20);
  });

  it("moves through flop, draw, turn, river and showdown streets", () => {
    const controller = createController({ deckCards: [...STARTING_DECK] });
    controller.startNewHand();

    controller.applyPlayerAction({ seatIndex: 0, action: "call" });
    controller.applyPlayerAction({ seatIndex: 1, action: "call" });
    controller.applyPlayerAction({ seatIndex: 2, action: "check" });
    expect(controller.state.street).toBe("FLOP");
    expect(controller.state.boardCards).toHaveLength(3);

    [1, 2, 0].forEach((seatIndex) => {
      controller.applyPlayerAction({ seatIndex, action: "check" });
    });
    expect(controller.state.street).toBe("DRAW");
    expect(controller.getSnapshot().phase).toBe("DRAW");
    controller.state.players.forEach((player) => {
      expect(player.hasDrawn).toBe(false);
      expect(player.hasActedThisStreet).toBe(false);
      expect(player.hasActedThisRound).toBe(false);
    });

    [1, 2, 0].forEach((seatIndex) => {
      controller.applyPlayerAction({
        seatIndex,
        action: "draw",
        metadata: { discardIndexes: seatIndex === 0 ? [0, 1] : [] },
      });
    });
    expect(controller.state.street).toBe("TURN");
    expect(controller.state.boardCards).toHaveLength(4);

    [1, 2, 0].forEach((seatIndex) => {
      controller.applyPlayerAction({ seatIndex, action: "check" });
    });
    expect(controller.state.street).toBe("RIVER");
    expect(controller.state.boardCards).toHaveLength(5);

    [1, 2, 0].forEach((seatIndex) => {
      controller.applyPlayerAction({ seatIndex, action: "check" });
    });
    expect(controller.state.street).toBe("SHOWDOWN");
  });

  it("enforces the published three-card draw cap for Zero and Badugi variants", () => {
    ["dramaha_zero", "dramaha_hidugi", "dramaha_badugi"].forEach((variant) => {
      const controller = createController({ variant, deckCards: [...STARTING_DECK] });
      controller.startNewHand();
      controller.state.street = "DRAW";
      controller.state.currentActor = 0;
      controller.state.players = controller.state.players.map((player, seatIndex) => ({
        ...player,
        folded: seatIndex !== 0,
        hasDrawn: seatIndex !== 0,
      }));

      const outcome = controller.applyPlayerAction({
        seatIndex: 0,
        action: "draw",
        metadata: { discardIndexes: [0, 1, 2, 3, 4] },
      });

      expect(outcome.success).toBe(true);
      expect(outcome.player.lastDrawCount).toBe(3);
      expect(controller.getSnapshot().maxDiscard).toBe(3);
    });
  });

  it("splits showdown between board and draw halves", () => {
    const controller = createController({
      seats: [
        { name: "Board", stack: 1000 },
        { name: "Draw", stack: 1000 },
      ],
      variant: "dramaha_hi",
    });
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.boardCards = ["2C", "7D", "7H", "9C", "JD"];
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: idx === 0
        ? ["2S", "2D", "AS", "KD", "QC"]
        : ["AH", "KH", "QH", "JH", "10H"],
      totalInvested: 100,
      stack: 900,
    }));

    const summary = controller.resolveShowdown();

    expect(summary.splitMode).toBe("boardAndDraw");
    expect(summary.potDetails).toHaveLength(2);
    expect(summary.potDetails[0]).toMatchObject({
      label: "Board half",
      componentLabel: "Board half",
      winnerSeatIndexes: [0],
    });
    expect(summary.potDetails[1]).toMatchObject({
      label: "Draw half",
      componentLabel: "Draw half",
      winnerSeatIndexes: [1],
    });
    expect(summary.winners.map((winner) => winner.payout)).toEqual([100, 100]);
  });

  it("marks Dramaha odd chips on the draw component", () => {
    const controller = createController({
      seats: [
        { name: "Board", stack: 1000 },
        { name: "Draw", stack: 1000 },
        { name: "Third", stack: 1000 },
      ],
      variant: "dramaha_hi",
    });
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.boardCards = ["2C", "7D", "7H", "9C", "JD"];
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: idx === 0
        ? ["2S", "2D", "AS", "KD", "QC"]
        : idx === 1
        ? ["AH", "KH", "QH", "JH", "10H"]
        : ["3S", "4D", "5C", "6H", "8S"],
      totalInvested: 33,
      stack: 0,
    }));

    const summary = controller.resolveShowdown();

    expect(summary.pot).toBe(99);
    expect(summary.potDetails.map((pot) => pot.amount)).toEqual([49, 50]);
    expect(summary.potDetails[0]).toMatchObject({ component: "board", oddChipAmount: 0 });
    expect(summary.potDetails[1]).toMatchObject({
      component: "draw",
      componentLabel: "Draw half",
      oddChipAmount: 1,
      oddChip: { amount: 1, component: "draw", componentLabel: "Draw half" },
    });
    expect(summary.oddChipRules).toEqual({
      splitPot: "draw-half",
      tiedComponent: "clockwise-from-button",
    });
  });

  it("awards a tied component remainder clockwise from the button", () => {
    const controller = createController({
      seats: [
        { name: "Tie 0", stack: 1000 },
        { name: "Lower", stack: 1000 },
        { name: "Tie 2", stack: 1000 },
      ],
      variant: "dramaha_hi",
    });
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.dealerIndex = 1;
    controller.state.boardCards = ["2C", "7D", "7H", "9C", "JD"];
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: [
        ["AS", "KD", "QH", "JC", "9S"],
        ["8S", "6D", "5H", "4C", "3S"],
        ["AH", "KC", "QS", "JD", "9H"],
      ][idx],
      totalInvested: 34,
      stack: 0,
    }));

    const summary = controller.resolveShowdown();
    const drawPot = summary.potDetails.find((pot) => pot.component === "draw");

    expect(drawPot.amount).toBe(51);
    expect(drawPot.winnerSeatIndexes).toEqual([2, 0]);
    expect(drawPot.winners.map(({ seatIndex, payout }) => ({ seatIndex, payout }))).toEqual([
      { seatIndex: 2, payout: 26 },
      { seatIndex: 0, payout: 25 },
    ]);
    expect(drawPot).toMatchObject({
      tieOddChipAmount: 1,
      tieOddChipRecipientSeatIndexes: [2],
      tieOddChipRule: "clockwise-from-button",
    });
  });

  it("keeps Dramaha side pots eligible before splitting board and draw halves", () => {
    const controller = createController({
      seats: [
        { name: "Main Board", stack: 1000 },
        { name: "Side Draw", stack: 1000 },
        { name: "Deep Stack", stack: 1000 },
      ],
      variant: "dramaha_hi",
    });
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.boardCards = ["2C", "7D", "7H", "9C", "JD"];
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: [
        ["2S", "2D", "AS", "KD", "QC"],
        ["AH", "KH", "QH", "JH", "10H"],
        ["3S", "4D", "5C", "6H", "8S"],
      ][idx],
      totalInvested: [50, 100, 200][idx],
      stack: 0,
    }));

    const summary = controller.resolveShowdown();

    expect(summary.potDetails.map((pot) => pot.amount)).toEqual([75, 75, 50, 50, 50, 50]);
    expect(summary.potDetails[0]).toMatchObject({ component: "board", winnerSeatIndexes: [0] });
    expect(summary.potDetails[1]).toMatchObject({ component: "draw", winnerSeatIndexes: [1] });
    expect(summary.potDetails[2]).toMatchObject({ component: "board", winnerSeatIndexes: [1] });
    expect(summary.potDetails[3]).toMatchObject({ component: "draw", winnerSeatIndexes: [1] });
    expect(summary.potDetails[4]).toMatchObject({ component: "board", winnerSeatIndexes: [2] });
    expect(summary.potDetails[5]).toMatchObject({ component: "draw", winnerSeatIndexes: [2] });
    expect(controller.state.players.map((player) => player.stack)).toEqual([75, 175, 100]);
  });
});
