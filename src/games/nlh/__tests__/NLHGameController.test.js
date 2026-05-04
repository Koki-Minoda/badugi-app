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

  it("preserves character metadata from table config", () => {
    const controller = createController({
      seats: [
        {
          name: "Hero",
          stack: 1000,
          avatarUrl: "/characters/hero.png",
          cpuCharacterId: null,
        },
        {
          name: "Kei",
          stack: 1000,
          avatarUrl: "/characters/kei.png",
          cpuCharacterId: "kei",
          cpuStyle: "standard",
        },
      ],
      deckCards,
      blinds,
    });

    const snapshot = controller.startNewHand();

    expect(snapshot.players[0]).toMatchObject({
      name: "Hero",
      avatarUrl: "/characters/hero.png",
    });
    expect(snapshot.players[1]).toMatchObject({
      name: "Kei",
      avatarUrl: "/characters/kei.png",
      cpuCharacterId: "kei",
      cpuStyle: "standard",
    });
  });

  it("skips busted seats when assigning blinds", () => {
    const controller = createController({
      seats: [
        { name: "Hero", stack: 1000 },
        { name: "Busted SB", stack: 0, seatOut: true, isBusted: true },
        { name: "CPU 2", stack: 1000 },
        { name: "CPU 3", stack: 1000 },
      ],
      deckCards: [
        "AS", "KS", "QD", "JC",
        "10H", "9D", "8C", "7S",
        "2C", "2D", "2H", "2S", "3C", "3D",
      ],
      blinds,
    });
    controller.state.dealerIndex = 3;

    const snapshot = controller.startNewHand();

    expect(snapshot.smallBlindIndex).toBe(2);
    expect(snapshot.bigBlindIndex).toBe(3);
    expect(snapshot.players[1].betThisStreet).toBe(0);
    expect(snapshot.players[2].betThisStreet).toBe(blinds.sb);
    expect(snapshot.players[3].betThisStreet).toBe(blinds.bb);
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

  it("advances to the flop when the preflop betting round completes", () => {
    const controller = createController({ seats, deckCards, blinds });
    controller.startNewHand();

    controller.applyPlayerAction({ seatIndex: 0, action: "call" });
    controller.applyPlayerAction({ seatIndex: 1, action: "call" });
    controller.applyPlayerAction({ seatIndex: 2, action: "check" });

    expect(controller.state.street).toBe("FLOP");
    expect(controller.state.boardCards).toHaveLength(3);
    expect(controller.state.currentBet).toBe(0);
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

  it("resolves side pots with eligibility restricted by total investment", () => {
    const controller = createController({
      seats: [
        { name: "Main Only", stack: 1000 },
        { name: "Side One", stack: 1000 },
        { name: "Deep Stack", stack: 1000 },
      ],
      deckCards,
      blinds,
    });
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.boardCards = ["2C", "7D", "9H", "JS", "QC"];
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: [
        ["AS", "AD"],
        ["KS", "KD"],
        ["3S", "4D"],
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

  it("returns a teacher-supervised CPU action for board-game betting", () => {
    const controller = createController({ seats, deckCards, blinds });
    controller.startNewHand();
    controller.state.currentActor = 0;
    controller.state.currentBet = 20;
    controller.state.players[0] = {
      ...controller.state.players[0],
      holeCards: ["AS", "AH"],
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
    expect(action.metadata.strength).toBeGreaterThan(0.8);
  });
});
