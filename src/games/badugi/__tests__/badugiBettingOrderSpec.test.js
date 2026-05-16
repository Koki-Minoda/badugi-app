import { describe, expect, it } from "vitest";
import BadugiGameController from "../BadugiGameController.js";
import { BadugiGameController as WrappedBadugiGameController } from "../controller/BadugiGameController.js";

const blinds = [{ sb: 5, bb: 10, ante: 0, hands: 999 }];
const hands = [
  ["AS", "2H", "3C", "4D"],
  ["2S", "3H", "4C", "5D"],
  ["3S", "4H", "5C", "6D"],
  ["4S", "5H", "6C", "7D"],
  ["5S", "6H", "7C", "8D"],
  ["6S", "7H", "8C", "9D"],
];

function startLegacyHand({ seats, dealerIdx = 0 }) {
  const controller = new BadugiGameController({
    numSeats: seats,
    blindStructure: blinds,
    lastStructureIndex: 0,
  });
  const result = controller.startNewHand({
    prevPlayers: null,
    currentPlayers: [],
    numSeats: seats,
    seatConfig: Array.from({ length: seats }, (_, seat) => (seat === 0 ? "HUMAN" : "CPU")),
    startingStack: 500,
    heroProfile: { name: "Hero" },
    nextDealerIdx: dealerIdx,
    blindStructure: blinds,
    blindState: { blindLevelIndex: 0, handsInLevel: 0 },
    lastStructureIndex: 0,
    drawCardsForSeat: (seat) => hands[seat] ?? hands[0],
  });
  return { controller, result };
}

describe("Badugi betting order spec", () => {
  it("starts 6max pre-draw betting at UTG left of BB", () => {
    const { result } = startLegacyHand({ seats: 6, dealerIdx: 0 });

    expect(result.sbIdx).toBe(1);
    expect(result.bbIdx).toBe(2);
    expect(result.resolvedTurn).toBe(3);
    expect(result.resolvedTurn).not.toBe(result.bbIdx);
  });

  it("starts 3way pre-draw betting at UTG left of BB", () => {
    const { result } = startLegacyHand({ seats: 3, dealerIdx: 0 });

    expect(result.sbIdx).toBe(1);
    expect(result.bbIdx).toBe(2);
    expect(result.resolvedTurn).toBe(0);
    expect(result.resolvedTurn).not.toBe(result.bbIdx);
  });

  it("starts heads-up pre-draw betting at BTN/SB", () => {
    const { result } = startLegacyHand({ seats: 2, dealerIdx: 0 });

    expect(result.sbIdx).toBe(0);
    expect(result.bbIdx).toBe(1);
    expect(result.resolvedTurn).toBe(0);
  });

  it("starts post-draw betting left of button and skips folded/all-in seats", () => {
    const controller = new WrappedBadugiGameController({
      numSeats: 6,
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"],
      startingStack: 500,
      blindStructure: blinds,
      lastStructureIndex: 0,
    });
    const initial = controller.createInitialState();
    const state = controller.createNewHandState(initial, {
      drawCardsForSeat: (seat) => hands[seat] ?? hands[0],
      nextDealerIdx: 0,
    });
    const snapshot = controller.getUiSnapshot(state);

    controller.legacy.state.players = snapshot.players.map((player, seat) => ({
      ...player,
      folded: seat === 1,
      hasFolded: seat === 1,
      allIn: seat === 2,
      hasActedThisRound: true,
      hasDrawn: true,
    }));
    controller.legacy.state.dealerIdx = 0;
    controller.legacy.state.drawRound = 0;
    controller.legacy.state.phase = "DRAW";

    controller._finishDrawRound(controller.legacy.state.players, 0);

    expect(controller.legacy.state.phase).toBe("BET");
    expect(controller.legacy.state.drawRound).toBe(1);
    expect(controller.legacy.state.nextTurn).toBe(3);
  });
});
