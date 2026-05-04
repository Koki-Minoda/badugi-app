import { describe, expect, it } from "vitest";
import {
  RazzduceyGameController,
  RazzdugiGameController,
  Stud8GameController,
} from "../StudGameController.js";

function createController(Controller, playerCount = 3) {
  return new Controller({
    tableConfig: {
      seats: Array.from({ length: playerCount }, (_, idx) => ({
        seatIndex: idx,
        name: `Seat ${idx}`,
        stack: 1000,
      })),
      blinds: { sb: 5, bb: 10, ante: 0 },
    },
  });
}

describe("Stud split controllers", () => {
  it("resolves Stud8 high/low across multiple side pots", () => {
    const controller = createController(Stud8GameController);
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: [
        ["AS", "AD", "KS", "KD", "QC", "JH", "9S"],
        ["AH", "2D", "3C", "4S", "7H", "9D", "TD"],
        ["2S", "2D", "2C", "2H", "3S", "4D", "9H"],
      ][idx],
      totalInvested: [50, 100, 150][idx],
      stack: 1000 - [50, 100, 150][idx],
    }));

    const summary = controller.resolveShowdown();

    expect(summary.splitMode).toBe("hiLo");
    expect(summary.potDetails).toHaveLength(3);
    expect(summary.potDetails[0].highWinners).toEqual([
      expect.objectContaining({ seatIndex: 2, payout: 75 }),
    ]);
    expect(summary.potDetails[0].lowWinners).toEqual([
      expect.objectContaining({ seatIndex: 1, payout: 75 }),
    ]);
    expect(summary.potDetails[1].highWinners).toEqual([
      expect.objectContaining({ seatIndex: 2, payout: 50 }),
    ]);
    expect(summary.potDetails[1].lowWinners).toEqual([
      expect.objectContaining({ seatIndex: 1, payout: 50 }),
    ]);
    expect(summary.potDetails[2].highWinners).toEqual([
      expect.objectContaining({ seatIndex: 2, payout: 50 }),
    ]);
    expect(summary.potDetails[2].lowWinners).toEqual([]);
  });

  it("splits Razzdugi into Badugi and A-5 low halves with odd chip to Badugi half", () => {
    const controller = createController(RazzdugiGameController);
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: [
        ["AS", "2H", "3D", "4C", "KS", "QH", "JD"],
        ["AH", "2D", "3S", "5C", "6H", "7D", "8S"],
        ["9S", "9H", "TC", "TD", "JS", "QD", "KH"],
      ][idx],
      totalInvested: idx === 0 ? 33 : 34,
      stack: 1000 - (idx === 0 ? 33 : 34),
    }));

    const summary = controller.resolveShowdown();

    expect(summary.splitMode).toBe("component");
    expect(summary.potDetails[0]).toMatchObject({ amount: 99 });
    expect(summary.potDetails[0].badugiWinners).toEqual([
      expect.objectContaining({ seatIndex: 0, payout: 50 }),
    ]);
    expect(summary.potDetails[0].lowWinners).toEqual([
      expect.objectContaining({ seatIndex: 1, payout: 49 }),
    ]);
  });

  it("splits Razzducey into Badugi and 2-7 low halves", () => {
    const controller = createController(RazzduceyGameController, 2);
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: idx === 0
        ? ["AS", "2H", "3D", "4C", "KS", "QH", "JD"]
        : ["2C", "3H", "4S", "5D", "7C", "8H", "9D"],
      totalInvested: 50,
      stack: 950,
    }));

    const summary = controller.resolveShowdown();

    expect(summary.splitMode).toBe("component");
    expect(summary.potDetails[0].badugiWinners).toEqual([
      expect.objectContaining({ seatIndex: 0, payout: 50 }),
    ]);
    expect(summary.potDetails[0].lowWinners).toEqual([
      expect.objectContaining({ seatIndex: 1, payout: 50 }),
    ]);
  });
});
