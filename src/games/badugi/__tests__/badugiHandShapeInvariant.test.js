import { describe, expect, it } from "vitest";
import { BadugiGameController } from "../controller/BadugiGameController.js";

const blinds = [{ sb: 5, bb: 10, ante: 0, hands: 999 }];
const fourCardHands = [
  ["AS", "2H", "3C", "4D"],
  ["2S", "3H", "4C", "5D"],
  ["3S", "4H", "5C", "6D"],
  ["4S", "5H", "6C", "7D"],
];

function createController() {
  return new BadugiGameController({
    numSeats: 4,
    seatConfig: ["HUMAN", "CPU", "CPU", "CPU"],
    startingStack: 500,
    blindStructure: blinds,
    lastStructureIndex: 0,
  });
}

describe("Badugi hand shape invariant", () => {
  it("deals exactly four cards to active Badugi seats", () => {
    const controller = createController();
    const state = controller.createNewHandState(controller.createInitialState(), {
      drawCardsForSeat: (seat) => fourCardHands[seat],
      nextDealerIdx: 0,
    });
    const snapshot = controller.getUiSnapshot(state);

    snapshot.players
      .filter((player) => !player.seatOut)
      .forEach((player) => {
        expect(player.hand).toHaveLength(4);
      });
  });

  it("rejects a stale five-card snapshot before syncing into Badugi", () => {
    const controller = createController();
    const state = controller.createNewHandState(controller.createInitialState(), {
      drawCardsForSeat: (seat) => fourCardHands[seat],
      nextDealerIdx: 0,
    });
    const snapshot = controller.getUiSnapshot(state);
    const stale = {
      ...snapshot,
      variantId: "badugi",
      players: snapshot.players.map((player, seat) => ({
        ...player,
        hand: seat === 0 ? ["AS", "2H", "3C", "4D", "5S"] : player.hand,
      })),
    };

    const synced = controller.syncFromExternalState({
      snapshot: stale,
      handIndex: state.handIndex,
      context: state.context,
    });

    expect(synced.lastEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "snapshotRejected",
          code: "SNAPSHOT_REJECTED_HAND_SHAPE_MISMATCH",
        }),
      ]),
    );
    expect(synced.snapshot.players[0].hand).toHaveLength(4);
  });

  it("rejects draw actions from a five-card Badugi hand", () => {
    const controller = createController();
    const state = controller.createNewHandState(controller.createInitialState(), {
      drawCardsForSeat: (seat) => fourCardHands[seat],
      nextDealerIdx: 0,
    });
    const snapshot = controller.getUiSnapshot(state);
    const staleState = {
      ...state,
      snapshot: {
        ...snapshot,
        phase: "DRAW",
        turn: 0,
        nextTurn: 0,
        players: snapshot.players.map((player, seat) => ({
          ...player,
          hand: seat === 0 ? ["AS", "2H", "3C", "4D", "5S"] : player.hand,
          hasDrawn: false,
          hasActedThisRound: false,
        })),
      },
    };

    const result = controller.applyAction(staleState, {
      seatIndex: 0,
      payload: { type: "draw", drawIndexes: [0] },
    });

    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "invalidAction",
          code: "SNAPSHOT_REJECTED_HAND_SHAPE_MISMATCH",
        }),
      ]),
    );
  });
});
