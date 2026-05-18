import { describe, expect, it } from "vitest";
import { AceToFiveSingleDrawController } from "../AceToFiveSingleDrawController.js";
import { AceToFiveTripleDrawController } from "../AceToFiveTripleDrawController.js";
import { DeuceToSevenSingleDrawController } from "../DeuceToSevenSingleDrawController.js";
import { DeuceToSevenTripleDrawController } from "../DeuceToSevenTripleDrawController.js";

const STRUCTURE = { sb: 10, bb: 20, ante: 0 };
const SIX_MAX = ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"];

const VARIANTS = [
  ["D01", DeuceToSevenTripleDrawController],
  ["D02", AceToFiveTripleDrawController],
  ["S01", DeuceToSevenSingleDrawController],
  ["S02", AceToFiveSingleDrawController],
];

function createHand(Controller, { dealerIndex = 0, seatConfig = SIX_MAX } = {}) {
  const controller = new Controller({
    tableConfig: {
      seatConfig,
      dealerIndex,
      structure: STRUCTURE,
      startingStack: 600,
    },
  });
  const state = controller.createNewHandState({}, { dealerIndex, structure: STRUCTURE });
  return { controller, state, engineState: state.engineState, snapshot: state.snapshot };
}

function activeBetSeat(player) {
  return Boolean(
    player &&
      !player.folded &&
      !player.sittingOut &&
      !player.seatOut &&
      !player.isBusted &&
      !player.allIn,
  );
}

function nextSeat(players, startIndex, predicate) {
  for (let offset = 0; offset < players.length; offset += 1) {
    const seatIndex = (startIndex + offset) % players.length;
    if (predicate(players[seatIndex], seatIndex)) return seatIndex;
  }
  return null;
}

function expectedOpeningActor(engineState) {
  const bbSeat = engineState.metadata?.lastBlinds?.bbIndex;
  if (typeof bbSeat !== "number") return null;
  return nextSeat(engineState.players, (bbSeat + 1) % engineState.players.length, activeBetSeat);
}

function toCall(engineState, seatIndex) {
  const currentBet = Math.max(
    Number(engineState.metadata?.currentBet) || 0,
    ...engineState.players.map((player) => Number(player?.bet) || 0),
  );
  return Math.max(0, currentBet - (Number(engineState.players[seatIndex]?.bet) || 0));
}

describe("Draw lowball opening actor order invariant", () => {
  it.each(VARIANTS)("%s opens from first live seat left of BB for every 6max button", (variantId, Controller) => {
    for (let dealerIndex = 0; dealerIndex < SIX_MAX.length; dealerIndex += 1) {
      const { engineState, snapshot } = createHand(Controller, { dealerIndex });
      const expected = expectedOpeningActor(engineState);
      const { sbIndex, bbIndex } = engineState.metadata.lastBlinds;

      expect(engineState.metadata.variantId).toBe(variantId);
      expect(engineState.dealerIndex).toBe(dealerIndex);
      expect(sbIndex).toBe((dealerIndex + 1) % SIX_MAX.length);
      expect(bbIndex).toBe((dealerIndex + 2) % SIX_MAX.length);
      expect(engineState.actingPlayerIndex).toBe(expected);
      expect(engineState.actingPlayerIndex).not.toBe(bbIndex);
      expect(snapshot.turn).toBe(expected);
      expect(snapshot.nextTurn).toBe(expected);
      expect(snapshot.currentBet).toBe(STRUCTURE.bb);
      expect(engineState.players[expected].bet).toBe(0);
      expect(toCall(engineState, expected)).toBe(STRUCTURE.bb);
    }
  });

  it("D01 hero UTG setup gives Hero first action and leaves MP unacted", () => {
    const { engineState, snapshot } = createHand(DeuceToSevenTripleDrawController, {
      dealerIndex: 3,
    });

    expect(engineState.metadata.lastBlinds).toMatchObject({ sbIndex: 4, bbIndex: 5 });
    expect(expectedOpeningActor(engineState)).toBe(0);
    expect(engineState.actingPlayerIndex).toBe(0);
    expect(snapshot.turn).toBe(0);
    expect(snapshot.players[0].betThisRound).toBe(0);
    expect(snapshot.players[1].betThisRound).toBe(0);
    expect(toCall(engineState, 0)).toBe(20);
  });

  it("D01 MP cannot act before UTG in an unopened pot", () => {
    const { controller, state, engineState } = createHand(DeuceToSevenTripleDrawController, {
      dealerIndex: 3,
    });

    const rejected = controller.applyAction(state, { seatIndex: 1, type: "call" });
    expect(rejected.events[0]).toMatchObject({ type: "invalidAction" });
    expect(rejected.events[0].error).toMatch(/out of turn/i);

    const accepted = controller.applyAction(state, { seatIndex: 0, type: "call" });
    expect(accepted.events[0]).not.toMatchObject({ type: "invalidAction" });
    expect(accepted.state.engineState.players[0].bet).toBe(20);
    expect(accepted.state.engineState.actingPlayerIndex).toBe(1);
    expect(engineState.players[1].bet).toBe(0);
  });

  it("heads-up keeps BTN/SB as the pre-draw opening actor", () => {
    for (const [variantId, Controller] of VARIANTS) {
      const { engineState } = createHand(Controller, {
        dealerIndex: 0,
        seatConfig: ["HUMAN", "CPU"],
      });

      expect(engineState.metadata.variantId).toBe(variantId);
      expect(engineState.metadata.lastBlinds).toMatchObject({ sbIndex: 0, bbIndex: 1 });
      expect(engineState.actingPlayerIndex).toBe(0);
    }
  });
});
