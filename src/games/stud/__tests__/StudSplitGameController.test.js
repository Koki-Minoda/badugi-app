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

function prepareStudStreet(controller, street, upCardsBySeat) {
  controller.startNewHand();
  controller.state.street = street;
  controller.state.currentBet = 0;
  controller.raiseCountThisStreet = 0;
  controller.state.pots = [];
  controller.state.players = controller.state.players.map((player, idx) => {
    const upCards = upCardsBySeat[idx] ?? ["9C"];
    const downCards = ["AS", "2D", "3H"].slice(0, street === "SEVENTH" ? 3 : 2);
    return {
      ...player,
      folded: false,
      seatOut: false,
      allIn: false,
      stack: 1000,
      totalInvested: 0,
      betThisStreet: 0,
      hasActedThisStreet: false,
      downCards,
      upCards,
      holeCards: [...downCards, ...upCards],
    };
  });
  controller.state.currentActor = controller.findFirstActionSeatForStreet();
  return controller.getSnapshot();
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

  it("completes a third-street bring-in to the small bet instead of over-raising", () => {
    const controller = createController(StudGameController, 3);
    controller.startNewHand();
    controller.state.street = "THIRD";
    controller.state.currentBet = 5;
    controller.state.bringInAmount = 5;
    controller.state.completeAmount = 10;
    controller.raiseCountThisStreet = 0;
    controller.state.players[1] = {
      ...controller.state.players[1],
      folded: false,
      seatOut: false,
      allIn: false,
      stack: 1000,
      betThisStreet: 0,
      totalInvested: 0,
      hasActedThisStreet: false,
    };

    const result = controller.applyPlayerAction({ seatIndex: 1, action: "raise" });

    expect(result.success).toBe(true);
    expect(controller.state.players[1].betThisStreet).toBe(10);
    expect(controller.state.currentBet).toBe(10);
    expect(controller.state.players[1].lastAction).toBe("Complete");
  });

  it("reopens Stud betting action after a full raise so earlier callers must respond", () => {
    const controller = createController(StudGameController, 3);
    controller.startNewHand();
    controller.state.street = "FOURTH";
    controller.state.currentBet = 10;
    controller.raiseCountThisStreet = 0;
    controller.state.players = controller.state.players.map((player, idx) => ({
      ...player,
      folded: false,
      seatOut: false,
      allIn: false,
      stack: 1000,
      betThisStreet: 10,
      totalInvested: 10,
      hasActedThisStreet: idx === 0,
    }));
    controller.state.currentActor = 1;

    const raiseResult = controller.applyPlayerAction({ seatIndex: 1, action: "raise", amount: 10 });

    expect(raiseResult.success).toBe(true);
    expect(controller.state.currentBet).toBe(20);
    expect(controller.state.players[0].hasActedThisStreet).toBe(false);
    expect(controller.state.players[1].hasActedThisStreet).toBe(true);
    expect(controller.state.currentActor).toBe(2);

    const coldCallResult = controller.applyPlayerAction({ seatIndex: 2, action: "call" });

    expect(coldCallResult.success).toBe(true);
    expect(controller.state.street).toBe("FOURTH");
    expect(controller.state.currentActor).toBe(0);

    const closingCallResult = controller.applyPlayerAction({ seatIndex: 0, action: "call" });

    expect(closingCallResult.success).toBe(true);
    expect(controller.state.street).toBe("FIFTH");
  });

  it("converts capped Stud raises to calls and advances after the cap is closed", () => {
    const controller = createController(StudGameController, 4);
    controller.startNewHand();
    controller.state.street = "FOURTH";
    controller.state.currentBet = 0;
    controller.state.bringInIndex = null;
    controller.state.bringInAmount = 0;
    controller.state.completeAmount = 0;
    controller.raiseCountThisStreet = 0;
    controller.state.players = controller.state.players.map((player) => ({
      ...player,
      folded: false,
      seatOut: false,
      allIn: false,
      stack: 1000,
      totalInvested: 0,
      betThisStreet: 0,
      hasActedThisStreet: false,
    }));
    controller.state.currentActor = 0;

    expect(controller.applyPlayerAction({ seatIndex: 0, action: "bet" }).success).toBe(true);
    expect(controller.applyPlayerAction({ seatIndex: 1, action: "raise" }).success).toBe(true);
    expect(controller.applyPlayerAction({ seatIndex: 2, action: "raise" }).success).toBe(true);
    expect(controller.applyPlayerAction({ seatIndex: 3, action: "raise" }).success).toBe(true);
    expect(controller.raiseCountThisStreet).toBe(controller.raiseCap);
    expect(controller.state.currentBet).toBe(40);

    const cappedAttempt = controller.applyPlayerAction({ seatIndex: 0, action: "raise" });

    expect(cappedAttempt.success).toBe(true);
    expect(controller.raiseCountThisStreet).toBe(controller.raiseCap);
    expect(controller.state.players[0].betThisStreet).toBe(40);
    expect(controller.state.players[0].lastAction).toBe("Call");
    expect(controller.state.currentBet).toBe(40);

    expect(controller.applyPlayerAction({ seatIndex: 1, action: "call" }).success).toBe(true);
    expect(controller.applyPlayerAction({ seatIndex: 2, action: "call" }).success).toBe(true);

    expect(controller.state.street).toBe("FIFTH");
    expect(controller.state.currentBet).toBe(0);
    expect(controller.raiseCountThisStreet).toBe(0);
  });

  it("posts bring-in from the highest up-card in Razz-family games with aces low", () => {
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

    expect(bringInSeat).toBe(2);
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

  it("resolves showdown after the seventh-street betting round completes", () => {
    const controller = createController(StudGameController, 3);
    controller.startNewHand();
    while (controller.getSnapshot().street !== "SEVENTH") {
      controller.advanceStreet();
    }
    controller.state.currentBet = 0;
    controller.state.currentActor = controller.findFirstActionSeatForStreet();
    controller.state.players = controller.state.players.map((player) => ({
      ...player,
      folded: false,
      seatOut: false,
      allIn: false,
      stack: 1000,
      betThisStreet: 0,
      hasActedThisStreet: false,
    }));

    const { snapshot } = playPassiveStudHandToShowdown(controller);

    expect(snapshot.street).toBe("SHOWDOWN");
    expect(controller.state.lastHandResult?.totalPot).toBeGreaterThanOrEqual(0);
  });

  it("keeps every Stud street open after only the first actor checks", () => {
    const streets = ["FOURTH", "FIFTH", "SIXTH", "SEVENTH"];
    const upCardsBySeat = [
      ["KS", "QD", "9C", "3H"],
      ["AH", "7D", "4C", "2S"],
      ["TC", "9D", "8H", "6S"],
      ["JC", "JD", "5H", "4S"],
    ];

    streets.forEach((street) => {
      const controller = createController(StudGameController, 4);
      const snapshot = prepareStudStreet(controller, street, upCardsBySeat);
      const opener = snapshot.currentActor;

      const result = controller.applyPlayerAction({ seatIndex: opener, action: "check" });

      expect(result.success).toBe(true);
      expect(controller.state.street).toBe(street);
      expect(controller.state.lastHandResult).toBe(null);
      expect(controller.state.currentActor).not.toBe(opener);
      expect(controller.state.currentActor).toEqual(expect.any(Number));
    });
  });

  it("starts later Stud streets from the best exposed high hand and Razz from the best exposed low hand", () => {
    const studController = createController(StudGameController, 4);
    prepareStudStreet(studController, "FOURTH", [
      ["KS", "QD"],
      ["AH", "2D"],
      ["TC", "9D"],
      ["JC", "JD"],
    ]);
    expect(studController.state.currentActor).toBe(1);

    const razzController = createController(RazzGameController, 4);
    prepareStudStreet(razzController, "FOURTH", [
      ["KS", "QD"],
      ["AH", "2D"],
      ["TC", "9D"],
      ["4C", "5D"],
    ]);
    expect(razzController.state.currentActor).toBe(1);
  });

  it("audits Stud and Razz live street rules: bring-in, complete, up/down cards, and 7th street", () => {
    const deckCards = [
      "AC", "2D", "KH", "4S",
      "5C", "6D", "7H", "8S",
      "2C", "AD", "KS", "9H",
      "3C", "4D", "5H", "6S",
      "7C", "8D", "9S", "TC",
      "JC", "QD", "QH", "JS",
      "9D", "8H", "7S", "6H",
    ];
    const deckFactory = () => ({
      cards: [...deckCards],
      reset() {
        this.cards = [...deckCards];
      },
      draw(count) {
        return this.cards.splice(0, count);
      },
    });
    const createAudited = (Controller) => new Controller({
      tableConfig: {
        seats: Array.from({ length: 4 }, (_, idx) => ({
          seatIndex: idx,
          name: `Audit ${idx}`,
          stack: 1000,
        })),
        blinds: { sb: 5, bb: 10, ante: 1 },
      },
      deckFactory,
    });

    const stud = createAudited(StudGameController);
    let snapshot = stud.startNewHand();
    expect(snapshot.players.map((player) => player.upCards[0])).toEqual(["2C", "AD", "KS", "9H"]);
    expect(snapshot.bringInIndex).toBe(0);
    expect(snapshot.bringInAmount).toBe(5);
    expect(snapshot.completeAmount).toBe(10);
    expect(snapshot.currentActor).toBe(1);

    const complete = stud.applyPlayerAction({ seatIndex: 1, action: "complete" });
    expect(complete.success).toBe(true);
    snapshot = stud.getSnapshot();
    expect(snapshot.currentBet).toBe(10);
    expect(snapshot.players[1].betThisStreet).toBe(10);
    expect(snapshot.players[1].lastAction).toBe("Complete");

    while (stud.getSnapshot().street !== "FOURTH") {
      const current = stud.getSnapshot();
      const actor = current.currentActor;
      const player = current.players[actor];
      const toCall = Math.max(0, current.currentBet - player.betThisStreet);
      expect(stud.applyPlayerAction({ seatIndex: actor, action: toCall > 0 ? "call" : "check" }).success).toBe(true);
    }
    snapshot = stud.getSnapshot();
    expect(snapshot.players.map((player) => player.upCards)).toEqual([
      ["2C", "3C"],
      ["AD", "4D"],
      ["KS", "5H"],
      ["9H", "6S"],
    ]);
    expect(snapshot.players.every((player) => player.downCards.length === 2)).toBe(true);
    expect(snapshot.currentActor).toBe(1);

    while (stud.getSnapshot().street !== "SEVENTH") stud.advanceStreet();
    snapshot = stud.getSnapshot();
    expect(snapshot.players.every((player) => player.holeCards.length === 7)).toBe(true);
    expect(snapshot.players.every((player) => player.upCards.length === 4)).toBe(true);
    expect(snapshot.players.every((player) => player.downCards.length === 3)).toBe(true);

    const razz = createAudited(RazzGameController);
    snapshot = razz.startNewHand();
    expect(snapshot.players.map((player) => player.upCards[0])).toEqual(["2C", "AD", "KS", "9H"]);
    expect(snapshot.bringInIndex).toBe(2);
    expect(snapshot.currentActor).toBe(3);

    razz.advanceStreet();
    snapshot = razz.getSnapshot();
    expect(snapshot.street).toBe("FOURTH");
    expect(snapshot.players.map((player) => player.upCards)).toEqual([
      ["2C", "3C"],
      ["AD", "4D"],
      ["KS", "5H"],
      ["9H", "6S"],
    ]);
    expect(snapshot.currentActor).toBe(0);
  });

  it("completes five consecutive Stud-family hands through all streets without broken actors", () => {
    const controllers = [
      StudGameController,
      Stud8GameController,
      RazzGameController,
      Razz27GameController,
      RazzdugiGameController,
      RazzduceyGameController,
    ];

    controllers.forEach((Controller) => {
      const controller = createController(Controller, 6);
      for (let hand = 0; hand < 5; hand += 1) {
        controller.startNewHand();
        const { snapshot, visitedStreets } = playPassiveStudHandToShowdown(controller, 160);
        expect(snapshot.street).toBe("SHOWDOWN");
        expect([...visitedStreets]).toEqual(
          expect.arrayContaining(["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "SHOWDOWN"]),
        );
        snapshot.players.forEach((player) => {
          expect(player.stack).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(player.stack)).toBe(true);
        });
      }
    });
  });

  it("returns a teacher-supervised CPU action for Stud-family betting", () => {
    const controller = createController(RazzGameController, 3);
    controller.startNewHand();
    controller.state.street = "FOURTH";
    controller.state.currentActor = 0;
    controller.state.currentBet = 0;
    controller.state.bringInIndex = null;
    controller.state.bringInAmount = 0;
    controller.state.completeAmount = 0;
    controller.state.players = controller.state.players.map((player) => ({
      ...player,
      folded: false,
      seatOut: false,
      allIn: false,
      stack: 1000,
      betThisStreet: 0,
      hasActedThisStreet: false,
    }));
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
