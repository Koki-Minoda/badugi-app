import { describe, expect, it } from "vitest";
import BadugiGameController from "../BadugiGameController.js";
import { resetBetRoundFlags } from "../engine/roundFlow.js";

const BLIND_STRUCTURE = [
  { sb: 5, bb: 10, ante: 0, hands: 1 },
  { sb: 10, bb: 20, ante: 0, hands: 999 },
];

const seatPlayer = (overrides = {}) => ({
  name: overrides.name ?? "Seat",
  folded: overrides.folded ?? false,
  seatOut: overrides.seatOut ?? false,
  allIn: overrides.allIn ?? false,
  betThisRound: overrides.betThisRound ?? 0,
  hasActedThisRound: overrides.hasActedThisRound ?? false,
  lastAction: overrides.lastAction ?? "",
  stack: overrides.stack ?? 500,
});

function createController(overrides = {}) {
  return new BadugiGameController({
    numSeats: 3,
    blindStructure: BLIND_STRUCTURE,
    lastStructureIndex: BLIND_STRUCTURE.length - 1,
    evaluateHand: overrides.evaluateHand,
  });
}

describe("BadugiGameController", () => {
  it("startNewHand posts blinds and advances blind counters", () => {
    const controller = createController();
    const result = controller.startNewHand({
      prevPlayers: null,
      currentPlayers: [],
      numSeats: 3,
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 500,
      heroProfile: { name: "Hero" },
      nextDealerIdx: 0,
      blindStructure: BLIND_STRUCTURE,
      blindState: { blindLevelIndex: 0, handsInLevel: 0 },
      lastStructureIndex: BLIND_STRUCTURE.length - 1,
      drawCardsForSeat: () => [],
    });

    expect(result.players).toHaveLength(3);
    expect(result.players[1].betThisRound).toBe(5);
    expect(result.players[2].betThisRound).toBe(10);
    expect(controller.getSnapshot().blindLevelIndex).toBe(0);
    expect(controller.getSnapshot().handsInLevel).toBe(1);
    expect(controller.getSnapshot().betHead).toBe(result.resolvedTurn);
  });

  it("applyPlayerAction updates player state and pending turn", () => {
    const controller = createController();
    const { players } = controller.startNewHand({
      prevPlayers: null,
      currentPlayers: [],
      numSeats: 3,
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 500,
      heroProfile: { name: "Hero" },
      nextDealerIdx: 0,
      blindStructure: BLIND_STRUCTURE,
      blindState: { blindLevelIndex: 0, handsInLevel: 0 },
      lastStructureIndex: BLIND_STRUCTURE.length - 1,
      drawCardsForSeat: () => [],
    });
    controller.syncExternalState({ players });

    const result = controller.applyPlayerAction({
      seatIndex: 1,
      payload: { type: "fold" },
    });

    expect(result.success).toBe(true);
    const snapshot = controller.getSnapshot();
    expect(snapshot.players[1].folded).toBe(true);
    const analysis = controller.advanceStreet({
      players: snapshot.players,
      actedIndex: 1,
      dealerIdx: snapshot.dealerIdx,
      drawRound: snapshot.drawRound,
    });
    expect(analysis.nextTurn).toBe(2);
  });

  it("resolveShowdown returns summarized results with handId", () => {
    const evaluateHand = (hand = []) => ({
      ranks: hand,
      activeCards: hand,
      deadCards: [],
      rankType: "BADUGI",
      count: hand.length,
    });
    const controller = createController({ evaluateHand });
    controller.setHandContext({ handId: "hand-123" });

    const players = [
      {
        name: "Hero",
        stack: 100,
        hand: ["AS", "KH", "QC", "JD"],
        betThisRound: 0,
        totalInvested: 50,
      },
      {
        name: "CPU",
        stack: 50,
        hand: ["2S", "3H", "4C", "5D"],
        betThisRound: 0,
        totalInvested: 50,
      },
    ];
    const summary = [
      {
        potIndex: 0,
        potAmount: 100,
        payouts: [{ seatIndex: 0, payout: 100 }],
      },
    ];

    const result = controller.resolveShowdown({
      players,
      summary,
      totalPot: 100,
      handId: "hand-123",
      evaluateHand,
    });

    expect(result.handId).toBe("hand-123");
    expect(result.pot).toBe(100);
    expect(result.winners).toHaveLength(1);
    expect(result.potDetails[0].potAmount).toBe(100);
  });

  it("resets bet-round acted flags before post-draw betting", () => {
    const controller = createController();
    const { players } = controller.startNewHand({
      prevPlayers: null,
      currentPlayers: [],
      numSeats: 3,
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 500,
      heroProfile: { name: "Hero" },
      nextDealerIdx: 0,
      blindStructure: BLIND_STRUCTURE,
      blindState: { blindLevelIndex: 0, handsInLevel: 0 },
      lastStructureIndex: BLIND_STRUCTURE.length - 1,
      drawCardsForSeat: () => [],
    });
    const dealerIdx = controller.getSnapshot().dealerIdx ?? 0;
    const stalePlayers = players.map((p, idx) => ({
      ...p,
      folded: idx === 1,
      hasFolded: idx === 1,
      allIn: false,
      betThisRound: 0,
      hasActedThisRound: true,
      lastAction: "",
    }));

    const before = controller.advanceStreet({
      players: stalePlayers,
      actedIndex: 2,
      dealerIdx,
      drawRound: 1,
      betHead: 2,
      lastAggressorIdx: null,
    });
    expect(before.nextTurn).toBeNull();

    const reset = resetBetRoundFlags(stalePlayers);
    const afterFirstActor = reset.map((p, idx) =>
      idx === 2
        ? { ...p, hasActedThisRound: true, lastAction: "Check" }
        : p
    );
    const after = controller.advanceStreet({
      players: afterFirstActor,
      actedIndex: 2,
      dealerIdx,
      drawRound: 1,
      betHead: 2,
      lastAggressorIdx: null,
    });
    expect(after.nextTurn).toBe(0);
  });

  it("keeps the big blind as the last actor when everyone limps", () => {
    const controller = new BadugiGameController({
      numSeats: 6,
      blindStructure: BLIND_STRUCTURE,
      lastStructureIndex: BLIND_STRUCTURE.length - 1,
    });
    const limpedPlayers = [
      seatPlayer({ name: "BTN", betThisRound: 10, hasActedThisRound: true, lastAction: "Call" }),
      seatPlayer({ name: "SB", betThisRound: 10, hasActedThisRound: true, lastAction: "Call" }),
      seatPlayer({ name: "Hero BB", betThisRound: 10, hasActedThisRound: false }),
      seatPlayer({ name: "UTG", betThisRound: 10, hasActedThisRound: true, lastAction: "Call" }),
      seatPlayer({ name: "MP", betThisRound: 10, hasActedThisRound: true, lastAction: "Call" }),
      seatPlayer({ name: "CO", betThisRound: 10, hasActedThisRound: true, lastAction: "Call" }),
    ];

    controller.syncExternalState({
      players: limpedPlayers,
      dealerIdx: 0,
      drawRound: 0,
      betHead: 2,
      lastAggressorIdx: 2,
    });

    const beforeHero = controller.advanceStreet({
      players: limpedPlayers,
      actedIndex: 5,
      dealerIdx: 0,
      drawRound: 0,
      betHead: 2,
      lastAggressorIdx: 2,
    });

    expect(beforeHero.nextTurn).toBe(2);
    expect(beforeHero.shouldAdvance).toBe(false);

    const heroChecked = limpedPlayers.map((player, idx) =>
      idx === 2
        ? { ...player, hasActedThisRound: true, lastAction: "Check" }
        : player
    );

    const afterHero = controller.advanceStreet({
      players: heroChecked,
      actedIndex: 2,
      dealerIdx: 0,
      drawRound: 0,
      betHead: 2,
      lastAggressorIdx: 2,
    });

    expect(afterHero.shouldAdvance).toBe(true);
    expect(afterHero.nextTurn).toBeNull();
  });

  it("forces the big blind to respond when action reopens with a raise", () => {
    const controller = new BadugiGameController({
      numSeats: 6,
      blindStructure: BLIND_STRUCTURE,
      lastStructureIndex: BLIND_STRUCTURE.length - 1,
    });
    const raisedPlayers = [
      seatPlayer({ name: "BTN", betThisRound: 20, hasActedThisRound: true, lastAction: "Call" }),
      seatPlayer({ name: "SB", betThisRound: 20, hasActedThisRound: true, lastAction: "Call" }),
      seatPlayer({ name: "Hero BB", betThisRound: 10, hasActedThisRound: false }),
      seatPlayer({ name: "UTG", betThisRound: 20, hasActedThisRound: true, lastAction: "Call" }),
      seatPlayer({ name: "MP", betThisRound: 20, hasActedThisRound: true, lastAction: "Raise" }),
      seatPlayer({ name: "CO", betThisRound: 20, hasActedThisRound: true, lastAction: "Call" }),
    ];

    controller.syncExternalState({
      players: raisedPlayers,
      dealerIdx: 0,
      drawRound: 0,
      betHead: 4,
      lastAggressorIdx: 4,
    });

    const beforeHero = controller.advanceStreet({
      players: raisedPlayers,
      actedIndex: 5,
      dealerIdx: 0,
      drawRound: 0,
      betHead: 4,
      lastAggressorIdx: 4,
    });

    expect(beforeHero.nextTurn).toBe(2);
    expect(beforeHero.shouldAdvance).toBe(false);

    const heroCalls = raisedPlayers.map((player, idx) =>
      idx === 2
        ? {
            ...player,
            betThisRound: 20,
            hasActedThisRound: true,
            lastAction: "Call",
          }
        : player
    );

    const afterHero = controller.advanceStreet({
      players: heroCalls,
      actedIndex: 2,
      dealerIdx: 0,
      drawRound: 0,
      betHead: 4,
      lastAggressorIdx: 4,
    });

    expect(afterHero.shouldAdvance).toBe(true);
    expect(afterHero.nextTurn).toBeNull();
  });
});
