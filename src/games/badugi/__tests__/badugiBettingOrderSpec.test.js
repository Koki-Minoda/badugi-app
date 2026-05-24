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

function actorFrom(snapshot = {}) {
  return snapshot.turn ?? snapshot.nextTurn ?? snapshot.metadata?.actingPlayerIndex ?? null;
}

describe("Badugi betting order spec", () => {
  it("starts 6max pre-draw betting at UTG left of BB", () => {
    const { result } = startLegacyHand({ seats: 6, dealerIdx: 0 });

    expect(result.sbIdx).toBe(1);
    expect(result.bbIdx).toBe(2);
    expect(result.resolvedTurn).toBe(3);
    expect(result.resolvedTurn).not.toBe(result.bbIdx);
  });

  it.each([
    ["5max", 5, 3],
    ["4max", 4, 3],
    ["3max", 3, 0],
  ])("starts %s pre-draw betting at the first eligible seat left of BB", (_label, seats, expected) => {
    const { result } = startLegacyHand({ seats, dealerIdx: 0 });

    expect(result.sbIdx).toBe(1);
    expect(result.bbIdx).toBe(2);
    expect(result.resolvedTurn).toBe(expected);
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

  it("skips a busted UTG seat at BET R1 open", () => {
    const controller = new BadugiGameController({
      numSeats: 6,
      blindStructure: blinds,
      lastStructureIndex: 0,
    });
    const prevPlayers = Array.from({ length: 6 }, (_, seat) => ({
      seatIndex: seat,
      name: `Seat ${seat}`,
      seatType: seat === 0 ? "HUMAN" : "CPU",
      stack: seat === 3 ? 0 : 500,
      isBusted: seat === 3,
      seatOut: seat === 3,
    }));
    const result = controller.startNewHand({
      prevPlayers,
      currentPlayers: [],
      numSeats: 6,
      seatConfig: Array.from({ length: 6 }, (_, seat) => (seat === 0 ? "HUMAN" : "CPU")),
      startingStack: 500,
      heroProfile: { name: "Hero" },
      nextDealerIdx: 0,
      blindStructure: blinds,
      blindState: { blindLevelIndex: 0, handsInLevel: 0 },
      lastStructureIndex: 0,
      drawCardsForSeat: (seat) => hands[seat] ?? hands[0],
    });

    expect(result.sbIdx).toBe(1);
    expect(result.bbIdx).toBe(2);
    expect(result.players[3].isBusted).toBe(true);
    expect(result.resolvedTurn).toBe(4);
  });

  it("keeps UI snapshot turn, nextTurn, and metadata actor aligned at BET R1 open", () => {
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

    expect(snapshot.phase).toBe("BET");
    expect(snapshot.drawRound).toBe(0);
    expect(snapshot.turn).toBe(3);
    expect(snapshot.nextTurn).toBe(3);
    expect(snapshot.metadata?.actingPlayerIndex).toBe(3);
    expect(actorFrom(snapshot)).toBe(3);
  });

  it("resolves null actor when only 1 eligible betting seat remains (RISK-03 regression)", () => {
    // With <2 eligible betting seats, resolveOpeningBetActor returns null.
    // Old firstBetterAfterBlinds returned a non-null start position as a fallback.
    const controller = new BadugiGameController({
      numSeats: 4,
      blindStructure: blinds,
      lastStructureIndex: 0,
    });
    const prevPlayers = Array.from({ length: 4 }, (_, seat) => ({
      seatIndex: seat,
      name: `Seat ${seat}`,
      seatType: seat === 0 ? "HUMAN" : "CPU",
      stack: seat === 0 ? 500 : 0,
      isBusted: seat !== 0,
      seatOut: seat !== 0,
    }));
    const result = controller.startNewHand({
      prevPlayers,
      currentPlayers: [],
      numSeats: 4,
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU"],
      startingStack: 500,
      heroProfile: { name: "Hero" },
      nextDealerIdx: 0,
      blindStructure: blinds,
      blindState: { blindLevelIndex: 0, handsInLevel: 0 },
      lastStructureIndex: 0,
      drawCardsForSeat: (seat) => hands[seat] ?? hands[0],
    });

    expect(result.resolvedTurn).toBeNull();
  });

  it("does not select busted seat 0 as fallback when fewer than 2 eligible betting seats (RISK-03 regression)", () => {
    // Seat 2 is the only eligible actor. Seat 0 is busted and must never be
    // chosen as a fallback — old code could coerce the start position (seat 0)
    // into a non-null turn even though seat 0 is out.
    const controller = new BadugiGameController({
      numSeats: 4,
      blindStructure: blinds,
      lastStructureIndex: 0,
    });
    const prevPlayers = Array.from({ length: 4 }, (_, seat) => ({
      seatIndex: seat,
      name: `Seat ${seat}`,
      seatType: seat === 0 ? "HUMAN" : "CPU",
      stack: seat === 2 ? 500 : 0,
      isBusted: seat !== 2,
      seatOut: seat !== 2,
    }));
    const result = controller.startNewHand({
      prevPlayers,
      currentPlayers: [],
      numSeats: 4,
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU"],
      startingStack: 500,
      heroProfile: { name: "Hero" },
      nextDealerIdx: 0,
      blindStructure: blinds,
      blindState: { blindLevelIndex: 0, handsInLevel: 0 },
      lastStructureIndex: 0,
      drawCardsForSeat: (seat) => hands[seat] ?? hands[0],
    });

    expect(result.resolvedTurn).toBeNull();
    expect(result.resolvedTurn).not.toBe(0);
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
