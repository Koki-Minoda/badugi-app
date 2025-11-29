import { describe, it, expect, beforeEach } from "vitest";
import NLHGameController from "../NLHGameController.js";

class StubDeck {
  constructor(cards = []) {
    this.cards = [...cards];
  }

  draw(n) {
    const drawn = [];
    for (let i = 0; i < n; i += 1) {
      if (this.cards.length === 0) break;
      drawn.push(this.cards.shift());
    }
    return drawn;
  }
}

function createController({ seats, deckCards, blinds }) {
  const tableConfig = {
    seats,
    blinds,
  };
  return new NLHGameController({
    tableConfig,
    deckFactory: () => new StubDeck(deckCards),
  });
}

describe("NLHGameController", () => {
  let seats;
  let deckCards;
  let blinds;

  beforeEach(() => {
    seats = [
      { name: "Hero", stack: 1000 },
      { name: "CPU 1", stack: 1000 },
      { name: "CPU 2", stack: 1000 },
    ];
    deckCards = [
      "AS", "KS", "QD",
      "JC", "10H", "9D",
      "2C", "2D", "2H", "2S", "3C", "3D",
    ];
    blinds = { sb: 10, bb: 20, ante: 0 };
  });

  it("starts a new hand with hole cards and blinds applied", () => {
    const controller = createController({ seats, deckCards, blinds });
    const snapshot = controller.startNewHand();

    expect(snapshot.street).toBe("PREFLOP");
    snapshot.players.forEach((player) => {
      if (!player.seatOut) {
        expect(player.holeCards).toHaveLength(2);
      }
    });
    expect(snapshot.boardCards).toHaveLength(0);
    const sbPlayer = snapshot.players[snapshot.smallBlindIndex];
    const bbPlayer = snapshot.players[snapshot.bigBlindIndex];
    expect(sbPlayer.betThisStreet).toBe(blinds.sb);
    expect(bbPlayer.betThisStreet).toBe(blinds.bb);
    expect(snapshot.currentActor).toBe(0);
  });

  it("progresses streets and deals board cards", () => {
    const controller = createController({ seats, deckCards, blinds });
    controller.startNewHand();
    controller.advanceStreet();
    expect(controller.state.street).toBe("FLOP");
    expect(controller.state.boardCards).toHaveLength(3);

    controller.advanceStreet();
    expect(controller.state.street).toBe("TURN");
    expect(controller.state.boardCards).toHaveLength(4);

    controller.advanceStreet();
    expect(controller.state.street).toBe("RIVER");
    expect(controller.state.boardCards).toHaveLength(5);

    controller.advanceStreet();
    expect(controller.state.street).toBe("SHOWDOWN");
  });

  it("resolves showdown and returns winning summary", () => {
    const controller = createController({ seats, deckCards, blinds });
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.boardCards = ["2H", "5H", "8H", "KD", "3C"];
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: idx === 0 ? ["AH", "QH"] : ["AS", "QC"],
      totalInvested: 500,
      stack: 500,
    }));

    const summary = controller.resolveShowdown();
    expect(summary.totalPot).toBe(1500);
    expect(summary.board).toEqual(["2H", "5H", "8H", "KD", "3C"]);
    expect(summary.winners).toHaveLength(1);
    expect(summary.winners[0].seatIndex).toBe(0);
    expect(summary.winners[0].evaluation.category).toBe("FLUSH");
    expect(controller.state.players[0].stack).toBeGreaterThan(seats[0].stack);
  });
});
