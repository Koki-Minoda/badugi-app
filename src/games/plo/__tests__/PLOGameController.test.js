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

  it("resolves and stores result immediately when river betting completes", () => {
    const controller = createController({
      seats: [
        { name: "Hero", stack: 1000 },
        { name: "CPU 1", stack: 1000 },
      ],
      deckCards: [],
    });
    controller.startNewHand();
    controller.state.street = "RIVER";
    controller.state.boardCards = ["KS", "QS", "JS", "10S", "9S"];
    controller.state.currentActor = 0;
    controller.state.currentBet = 0;
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      allIn: false,
      hasActedThisStreet: false,
      betThisStreet: 0,
      holeCards: idx === 0
        ? ["AS", "AD", "7C", "8D"]
        : ["AS", "2S", "AC", "AD"],
      totalInvested: 100,
      stack: 900,
    }));

    expect(controller.applyPlayerAction({ seatIndex: 0, action: "check" }).success).toBe(true);
    expect(controller.state.street).toBe("RIVER");
    expect(controller.applyPlayerAction({ seatIndex: 1, action: "check" }).success).toBe(true);

    const snapshot = controller.getSnapshot();
    expect(snapshot.street).toBe("SHOWDOWN");
    expect(snapshot.lastHandResult).toBeTruthy();
    expect(snapshot.lastHandResult.winners.length).toBeGreaterThan(0);
    expect(snapshot.lastHandResult.board).toHaveLength(5);
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

  it("resolves side pots using Omaha eligibility and exactly-two evaluation", () => {
    const controller = createController({
      seats: [
        { name: "Main Only", stack: 1000 },
        { name: "Side One", stack: 1000 },
        { name: "Deep Stack", stack: 1000 },
      ],
      deckCards: [
        "AS", "KS", "QD",
        "AD", "KD", "4D",
        "3C", "4C", "5C",
        "2C", "7D", "9H", "JS", "QC",
      ],
    });
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.boardCards = ["2C", "7D", "9H", "JS", "QC"];
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: [
        ["AS", "AD", "3C", "4D"],
        ["KS", "KD", "5C", "6D"],
        ["3S", "4H", "5D", "6C"],
      ][idx],
      totalInvested: [50, 100, 200][idx],
      stack: 0,
    }));

    const summary = controller.resolveShowdown();

    expect(summary.potDetails.map((pot) => pot.amount)).toEqual([150, 100, 100]);
    expect(summary.potDetails[0].winnerSeatIndexes).toEqual([0]);
    expect(summary.potDetails[1].winnerSeatIndexes).toEqual([1]);
    expect(summary.potDetails[2].winnerSeatIndexes).toEqual([2]);
    expect(controller.state.players.map((player) => player.stack)).toEqual([150, 100, 100]);
  });

  it("returns a teacher-supervised CPU action for coordinated Omaha starts", () => {
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
    controller.state.currentActor = 0;
    controller.state.currentBet = 20;
    controller.state.players[0] = {
      ...controller.state.players[0],
      holeCards: ["AS", "KS", "QD", "JD"],
      betThisStreet: 20,
      stack: 980,
      folded: false,
      seatOut: false,
      allIn: false,
    };

    const action = controller.getCpuAction(controller.getSnapshot(), 0, {
      tierConfig: { id: "standard" },
    });

    expect(action).toMatchObject({
      seatIndex: 0,
      type: "BET",
      metadata: expect.objectContaining({ strategy: "teacher-supervised" }),
    });
    expect(action.metadata.strength).toBeGreaterThan(0.65);
  });
});
