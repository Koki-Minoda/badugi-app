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

  it("moves through flop, draw, final and showdown streets", () => {
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

    [1, 2, 0].forEach((seatIndex) => {
      controller.applyPlayerAction({
        seatIndex,
        action: "draw",
        metadata: { discardIndexes: seatIndex === 0 ? [0, 1] : [] },
      });
    });
    expect(controller.state.street).toBe("FINAL");

    [1, 2, 0].forEach((seatIndex) => {
      controller.applyPlayerAction({ seatIndex, action: "check" });
    });
    expect(controller.state.street).toBe("SHOWDOWN");
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
    controller.state.boardCards = ["2C", "7D", "7H"];
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
      winnerSeatIndexes: [0],
    });
    expect(summary.potDetails[1]).toMatchObject({
      label: "Draw half",
      winnerSeatIndexes: [1],
    });
    expect(summary.winners.map((winner) => winner.payout)).toEqual([100, 100]);
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
    controller.state.boardCards = ["2C", "7D", "7H"];
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
