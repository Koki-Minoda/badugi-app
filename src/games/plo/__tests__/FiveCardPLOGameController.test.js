import { describe, expect, it } from "vitest";
import FiveCardPLOGameController from "../FiveCardPLOGameController.js";
import BigOGameController from "../BigOGameController.js";
import { evaluateFiveCardPloHand } from "../utils/ploEvaluator.js";

class StubDeck {
  constructor(cards = []) {
    this.cards = [...cards];
  }

  draw(n) {
    return this.cards.splice(0, n);
  }
}

const seats = [
  { name: "Hero", stack: 1000 },
  { name: "CPU 1", stack: 1000 },
  { name: "CPU 2", stack: 1000 },
];

const deckCards = [
  "AS", "KS", "QD",
  "JC", "10H", "9D",
  "8C", "7S", "6H",
  "5C", "4D", "3S",
  "2C", "2D", "2H",
  "2S", "3C", "3D", "4C", "4H",
];

function createController(Controller = FiveCardPLOGameController) {
  return new Controller({
    tableConfig: {
      seats,
      blinds: { sb: 10, bb: 20, ante: 0 },
    },
    deckFactory: () => new StubDeck(deckCards),
  });
}

describe("FiveCardPLOGameController", () => {
  it("deals five hole cards", () => {
    const controller = createController();
    const snapshot = controller.startNewHand();

    snapshot.players.forEach((player) => {
      expect(player.holeCards).toHaveLength(5);
    });
  });

  it("keeps the exactly-two hole rule with five-card hands", () => {
    const evaluation = evaluateFiveCardPloHand({
      holeCards: ["AS", "AD", "AC", "AH", "2D"],
      boardCards: ["KS", "QS", "JS", "10S", "9S"],
    });

    expect(evaluation.category).not.toBe("STRAIGHT_FLUSH");
    expect(evaluation.holeCardsUsed).toHaveLength(2);
    expect(evaluation.boardCardsUsed).toHaveLength(3);
  });

  it("Big-O uses the same five-card Omaha high route for now", () => {
    const controller = createController(BigOGameController);
    const snapshot = controller.startNewHand();

    expect(snapshot.players[0].holeCards).toHaveLength(5);
    expect(controller.config.gameDefinition.variant).toBe("big_o");
  });
});
