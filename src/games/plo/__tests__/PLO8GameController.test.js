import { describe, expect, it } from "vitest";
import PLO8GameController from "../PLO8GameController.js";

class StubDeck {
  constructor(cards = []) {
    this.cards = [...cards];
  }

  draw(n) {
    return this.cards.splice(0, n);
  }
}

function createController() {
  return new PLO8GameController({
    tableConfig: {
      seats: [
        { seatIndex: 0, name: "High", stack: 1000 },
        { seatIndex: 1, name: "Low", stack: 1000 },
      ],
      blinds: { sb: 5, bb: 10, ante: 0 },
    },
    deckFactory: () => new StubDeck([]),
  });
}

describe("PLO8GameController", () => {
  it("splits high and qualifying 8-or-better low", () => {
    const controller = createController();
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.boardCards = ["2S", "3S", "4H", "9S", "KC"];
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: idx === 0
        ? ["AS", "QS", "KS", "QH"]
        : ["AH", "5D", "7D", "8C"],
      totalInvested: 100,
      stack: 900,
    }));

    const summary = controller.resolveShowdown();

    expect(summary.splitMode).toBe("hiLo");
    expect(summary.totalPot).toBe(200);
    expect(summary.potDetails[0].highWinners).toEqual([
      expect.objectContaining({ seatIndex: 0, payout: 100 }),
    ]);
    expect(summary.potDetails[0].lowWinners).toEqual([
      expect.objectContaining({ seatIndex: 1, payout: 100 }),
    ]);
    expect(controller.state.players.map((player) => player.stack)).toEqual([1000, 1000]);
  });

  it("awards the full pot to high when no low qualifies", () => {
    const controller = createController();
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.boardCards = ["KC", "QD", "JH", "9S", "3C"];
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: idx === 0
        ? ["AS", "AD", "KS", "QH"]
        : ["AH", "5S", "7D", "8C"],
      totalInvested: 100,
      stack: 900,
    }));

    const summary = controller.resolveShowdown();

    expect(summary.potDetails[0].highWinners).toEqual([
      expect.objectContaining({ seatIndex: 0, payout: 200 }),
    ]);
    expect(summary.potDetails[0].lowWinners).toEqual([]);
    expect(controller.state.players.map((player) => player.stack)).toEqual([1100, 900]);
  });
});
