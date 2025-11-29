import { describe, expect, it } from "vitest";
import BadugiGameController from "../BadugiGameController.js";
import { resetBetRoundFlags } from "../engine/roundFlow.js";

const BLIND_STRUCTURE = [
  { sb: 5, bb: 10, ante: 0, hands: 1 },
  { sb: 10, bb: 20, ante: 0, hands: 999 },
];

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
    expect(analysis.nextTurn).toBe(0);
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
});
