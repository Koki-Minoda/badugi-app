import { describe, expect, it } from "vitest";
import {
  Razz27GameController,
  RazzduceyGameController,
  RazzdugiGameController,
  RazzGameController,
  StudGameController,
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

function playPassiveStudHandToShowdown(controller, maxActions = 80) {
  const visitedStreets = new Set([controller.getSnapshot().street]);
  for (let actions = 0; actions < maxActions; actions += 1) {
    const snapshot = controller.getSnapshot();
    visitedStreets.add(snapshot.street);
    if (snapshot.street === "SHOWDOWN") return { snapshot, visitedStreets, actions };
    const actor = snapshot.currentActor;
    expect(actor).toEqual(expect.any(Number));
    const player = snapshot.players[actor];
    expect(player).toEqual(expect.objectContaining({ seatIndex: actor }));
    expect(player.folded).toBe(false);
    expect(player.seatOut).toBe(false);
    expect(player.allIn).toBe(false);
    const toCall = Math.max(0, (snapshot.currentBet ?? 0) - (player.betThisStreet ?? 0));
    const result = controller.applyPlayerAction({ seatIndex: actor, action: toCall > 0 ? "call" : "check" });
    expect(result.success).toBe(true);
  }
  throw new Error("Stud hand did not reach showdown within action limit");
}

describe("Stud split controllers", () => {
  it("deals Stud streets incrementally instead of pre-dealing seven cards", () => {
    const controller = createController(StudGameController, 3);
    let snapshot = controller.startNewHand();

    snapshot.players.filter((player) => !player.folded && !player.seatOut).forEach((player) => {
      expect(player.holeCards).toHaveLength(3);
      expect(player.downCards).toHaveLength(2);
      expect(player.upCards).toHaveLength(1);
    });

    const expectedLengths = [
      ["FOURTH", 4, 2, 2],
      ["FIFTH", 5, 2, 3],
      ["SIXTH", 6, 2, 4],
      ["SEVENTH", 7, 3, 4],
    ];
    expectedLengths.forEach(([street, totalCards, downCards, upCards]) => {
      controller.advanceStreet();
      snapshot = controller.getSnapshot();
      expect(snapshot.street).toBe(street);
      snapshot.players.filter((player) => !player.folded && !player.seatOut).forEach((player) => {
        expect(player.holeCards).toHaveLength(totalCards);
        expect(player.downCards).toHaveLength(downCards);
        expect(player.upCards).toHaveLength(upCards);
      });
    });

    controller.advanceStreet();
    expect(controller.getSnapshot().street).toBe("SHOWDOWN");
  });

  it("continues dealing live all-in Stud hands through showdown without invalid actors", () => {
    const controller = createController(StudGameController, 2);
    controller.startNewHand();
    controller.state.players = controller.state.players.map((player) => ({
      ...player,
      folded: false,
      seatOut: false,
      allIn: true,
      stack: 0,
      totalInvested: 100,
      betThisStreet: 0,
    }));

    const snapshot = controller.advanceStreet();

    expect(snapshot.street).toBe("SHOWDOWN");
    snapshot.players.forEach((player) => {
      expect(player.holeCards).toHaveLength(7);
    });
  });

  it("posts bring-in from the lowest up-card in Stud and next actor follows", () => {
    const controller = createController(StudGameController, 3);
    controller.startNewHand();
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      allIn: false,
      stack: 1000,
      totalInvested: 0,
      betThisStreet: 0,
      upCards: [["2C"], ["AH"], ["7S"]][idx],
    }));

    const bringInSeat = controller.findBringInSeat();

    expect(bringInSeat).toBe(0);
  });

  it("posts bring-in from the highest up-card in Razz-family games", () => {
    const controller = createController(RazzGameController, 3);
    controller.startNewHand();
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      allIn: false,
      stack: 1000,
      totalInvested: 0,
      betThisStreet: 0,
      upCards: [["2C"], ["AH"], ["KS"]][idx],
    }));

    const bringInSeat = controller.findBringInSeat();

    expect(bringInSeat).toBe(1);
  });

  it("plays Razz through every stud street to showdown with seven-card hands", () => {
    const controller = createController(RazzGameController, 4);
    controller.startNewHand();

    const { snapshot, visitedStreets } = playPassiveStudHandToShowdown(controller);

    expect([...visitedStreets]).toEqual(
      expect.arrayContaining(["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "SHOWDOWN"]),
    );
    snapshot.players.filter((player) => !player.folded && !player.seatOut).forEach((player) => {
      expect(player.holeCards).toHaveLength(7);
      expect(player.downCards).toHaveLength(3);
      expect(player.upCards).toHaveLength(4);
    });
    const summary = controller.resolveShowdown();
    expect(summary.splitMode).toBe("single");
  });

  it("returns a teacher-supervised CPU action for Stud-family betting", () => {
    const controller = createController(RazzGameController, 3);
    controller.startNewHand();
    controller.state.currentActor = 0;
    controller.state.currentBet = 0;
    controller.state.players[0] = {
      ...controller.state.players[0],
      holeCards: ["AS", "2D", "4C"],
      downCards: ["AS", "2D"],
      upCards: ["4C"],
      betThisStreet: 0,
      stack: 1000,
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
      metadata: expect.objectContaining({
        strategy: "teacher-supervised",
        variant: "razz",
      }),
    });
  });

  it("plays Razz27 through every stud street to showdown with 2-7 low evaluation", () => {
    const controller = createController(Razz27GameController, 4);
    controller.startNewHand();

    const { visitedStreets } = playPassiveStudHandToShowdown(controller);

    expect([...visitedStreets]).toEqual(
      expect.arrayContaining(["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "SHOWDOWN"]),
    );
    const summary = controller.resolveShowdown();
    expect(summary.splitMode).toBe("single");
    expect(summary.potDetails?.[0]?.winners?.[0]?.evaluation?.handName).toBe("2-7 Low");
  });

  it("resolves 2-7 Razz as a single 2-7 lowball pot", () => {
    const controller = createController(Razz27GameController, 2);
    controller.startNewHand();
    controller.state.street = "SHOWDOWN";
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      holeCards: idx === 0
        ? ["7S", "5D", "4C", "3H", "2S", "KD", "QC"]
        : ["AS", "5D", "4C", "3H", "2S", "KD", "QC"],
      totalInvested: 50,
      stack: 950,
    }));

    const summary = controller.resolveShowdown();

    expect(summary.splitMode).toBe("single");
    expect(summary.potDetails[0].winners).toEqual([
      expect.objectContaining({ seatIndex: 0, payout: 100 }),
    ]);
  });

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
