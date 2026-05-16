import { describe, expect, it } from "vitest";
import BadugiGameController from "../BadugiGameController.js";
import { BadugiUIAdapter } from "../../../ui/game/badugi/BadugiUIAdapter.js";

const blinds = [{ sb: 5, bb: 10, ante: 0, hands: 999 }];
const hands = [
  ["AS", "2H", "3C", "4D"],
  ["2S", "3H", "4C", "5D"],
  ["3S", "4H", "5C", "6D"],
];

function startHand() {
  const controller = new BadugiGameController({
    numSeats: 3,
    blindStructure: blinds,
    lastStructureIndex: 0,
  });
  const result = controller.startNewHand({
    prevPlayers: null,
    currentPlayers: [],
    numSeats: 3,
    seatConfig: ["HUMAN", "CPU", "CPU"],
    startingStack: 500,
    heroProfile: { name: "Hero" },
    nextDealerIdx: 0,
    blindStructure: blinds,
    blindState: { blindLevelIndex: 0, handsInLevel: 0 },
    lastStructureIndex: 0,
    drawCardsForSeat: (seat) => hands[seat],
  });
  return { controller, result };
}

function potTotal(snapshot) {
  const adapter = new BadugiUIAdapter({});
  return adapter.buildViewProps({
    controllerSnapshot: snapshot,
    tableConfig: { bbValue: 10, maxDraws: 3 },
  }).potView.total;
}

describe("Badugi pot continuity spec", () => {
  it("renders nonzero pot after blinds", () => {
    const { controller } = startHand();

    expect(potTotal(controller.getSnapshot())).toBeGreaterThan(0);
  });

  it("keeps active-hand pot visible when street bets reset after draw transition", () => {
    const { controller } = startHand();
    const snapshot = controller.getSnapshot();
    const transitioned = {
      ...snapshot,
      phase: "BET",
      drawRound: 1,
      currentBet: 0,
      pots: [],
      players: snapshot.players.map((player) => ({
        ...player,
        betThisRound: 0,
      })),
    };

    expect(potTotal(transitioned)).toBeGreaterThan(0);
  });

  it("prefers explicit pot amounts over investment fallback", () => {
    const { controller } = startHand();
    const snapshot = controller.getSnapshot();

    expect(potTotal({ ...snapshot, pots: [{ amount: 77, eligible: [0, 1, 2] }] })).toBe(77);
  });

  it("resets active pot only when a next hand starts", () => {
    const { controller, result } = startHand();
    const previousPlayers = result.players.map((player) => ({
      ...player,
      totalInvested: 0,
      betThisRound: 0,
    }));
    const next = controller.startNewHand({
      prevPlayers: previousPlayers,
      currentPlayers: previousPlayers,
      numSeats: 3,
      seatConfig: ["HUMAN", "CPU", "CPU"],
      startingStack: 500,
      heroProfile: { name: "Hero" },
      nextDealerIdx: 1,
      blindStructure: blinds,
      blindState: { blindLevelIndex: 0, handsInLevel: 1 },
      lastStructureIndex: 0,
      drawCardsForSeat: (seat) => hands[seat],
    });

    expect(next.players.reduce((sum, player) => sum + player.totalInvested, 0)).toBe(15);
    expect(potTotal(controller.getSnapshot())).toBe(15);
  });
});
