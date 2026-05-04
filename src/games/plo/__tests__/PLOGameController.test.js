import { describe, expect, it } from "vitest";
import PLOGameController from "../PLOGameController.js";

class StubDeck {
  constructor(cards = []) {
    this.cards = [...cards];
  }

  draw(n) {
    return this.cards.splice(0, n);
  }
}

function createController({ seats, deckCards, blinds = { sb: 10, bb: 20, ante: 0 } }) {
  return new PLOGameController({
    tableConfig: { seats, blinds },
    deckFactory: () => new StubDeck(deckCards),
  });
}

describe("PLOGameController", () => {
  it("deals four hole cards and posts blinds", () => {
    const controller = createController({
      seats: [
        { name: "Hero", stack: 1000 },
        { name: "CPU 1", stack: 1000 },
        { name: "CPU 2", stack: 1000 },
      ],
      deckCards: [
        "AS", "KS", "QD",
        "JC", "10H", "9D",
        "8C", "7S", "6H",
        "5C", "4D", "3S",
        "2C", "2D", "2H", "2S", "3C",
      ],
    });

    const snapshot = controller.startNewHand();

    snapshot.players.forEach((player) => {
      expect(player.holeCards).toHaveLength(4);
    });
    expect(snapshot.players[snapshot.smallBlindIndex].betThisStreet).toBe(10);
    expect(snapshot.players[snapshot.bigBlindIndex].betThisStreet).toBe(20);
  });

  it("resolves showdown using Omaha exactly-two rule", () => {
    const controller = createController({
      seats: [
        { name: "Hero", stack: 1000 },
        { name: "CPU 1", stack: 1000 },
      ],
      deckCards: [],
    });
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.boardCards = ["KS", "QS", "JS", "10S", "9S"];
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: idx === 0
        ? ["AS", "AD", "7C", "8D"]
        : ["AS", "2S", "AC", "AD"],
      totalInvested: 100,
      stack: 900,
    }));

    const summary = controller.resolveShowdown();

    expect(summary.winners).toHaveLength(1);
    expect(summary.winners[0].seatIndex).toBe(1);
    expect(summary.winners[0].evaluation.category).toBe("FLUSH");
    expect(summary.winners[0].evaluation.holeCardsUsed).toHaveLength(2);
    expect(summary.winners[0].evaluation.boardCardsUsed).toHaveLength(3);
  });

  it("caps bet and raise commits at pot-limit size", () => {
    const controller = createController({
      seats: [
        { name: "Hero", stack: 1000 },
        { name: "CPU 1", stack: 1000 },
        { name: "CPU 2", stack: 1000 },
      ],
      deckCards: [
        "AS", "KS", "QD",
        "JC", "10H", "9D",
        "8C", "7S", "6H",
        "5C", "4D", "3S",
      ],
    });
    controller.startNewHand();

    const result = controller.applyPlayerAction({
      seatIndex: 0,
      action: "raise",
      amount: 999,
    });

    expect(result.success).toBe(true);
    expect(controller.state.players[0].betThisStreet).toBe(70);
    expect(controller.state.currentBet).toBe(70);
  });
});
