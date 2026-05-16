import { describe, expect, it } from "vitest";
import { BadugiGameController } from "../controller/BadugiGameController.js";

const blinds = [{ sb: 5, bb: 10, ante: 0, hands: 999 }];
const hands = [
  ["AS", "2H", "3C", "4D"],
  ["KS", "KH", "KC", "KD"],
  ["QS", "QH", "QC", "QD"],
];

function createController() {
  return new BadugiGameController({
    numSeats: 3,
    seatConfig: ["HUMAN", "CPU", "CPU"],
    startingStack: 500,
    blindStructure: blinds,
    lastStructureIndex: 0,
  });
}

describe("Badugi showdown and next-hand spec", () => {
  it("resolves showdown after final betting round and exposes result metadata", () => {
    const controller = createController();
    let state = controller.createNewHandState(controller.createInitialState(), {
      drawCardsForSeat: (seat) => hands[seat],
      nextDealerIdx: 0,
    });
    const snapshot = controller.getUiSnapshot(state);
    state = controller.syncFromExternalState({
      snapshot: {
        ...snapshot,
        phase: "BET",
        drawRound: 3,
        currentBet: 0,
        turn: 0,
        nextTurn: 0,
        players: snapshot.players.map((player, seat) => ({
          ...player,
          hand: hands[seat],
          betThisRound: 0,
          totalInvested: seat === 0 ? 20 : 20,
          hasActedThisRound: seat !== 0,
          lastAction: seat === 0 ? "" : "Check",
        })),
      },
      handIndex: state.handIndex,
      context: state.context,
    });

    const result = controller.applyAction(state, {
      seatIndex: 0,
      payload: { type: "check" },
    });

    expect(result.events.some((event) => event.type === "betRoundComplete")).toBe(true);
    expect(result.state.snapshot.phase).toBe("SHOWDOWN");
    expect(result.state.snapshot.lastHandResult).toBeTruthy();
    expect(result.state.snapshot.lastHandResult.totalPot ?? result.state.snapshot.lastHandResult.pot).toBeGreaterThan(0);
  });

  it("ends hand immediately when folds leave one active player", () => {
    const controller = createController();
    const state = controller.createNewHandState(controller.createInitialState(), {
      drawCardsForSeat: (seat) => hands[seat],
      nextDealerIdx: 0,
    });
    const snapshot = controller.getUiSnapshot(state);
    const seeded = controller.syncFromExternalState({
      snapshot: {
        ...snapshot,
        phase: "BET",
        drawRound: 0,
        currentBet: 10,
        turn: 0,
        nextTurn: 0,
        players: snapshot.players.map((player, seat) => ({
          ...player,
          folded: seat === 1,
          hasFolded: seat === 1,
          hasActedThisRound: seat === 1,
          totalInvested: seat === 0 ? 10 : 10,
        })),
      },
      handIndex: state.handIndex,
      context: state.context,
    });

    const result = controller.applyAction(seeded, {
      seatIndex: 0,
      payload: { type: "fold" },
    });

    expect(result.events.some((event) => event.type === "invalidAction")).toBe(false);
    const active = result.state.snapshot.players.filter(
      (player) => !player.folded && !player.hasFolded && !player.seatOut,
    );
    expect(active).toHaveLength(1);
  });

  it("starts the next hand with reset street state and fresh blinds", () => {
    const controller = createController();
    const first = controller.createNewHandState(controller.createInitialState(), {
      drawCardsForSeat: (seat) => hands[seat],
      nextDealerIdx: 0,
    });
    const next = controller.createNewHandState(first, {
      drawCardsForSeat: (seat) => hands[seat],
    });
    const snapshot = controller.getUiSnapshot(next);

    expect(snapshot.phase).toBe("BET");
    expect(snapshot.drawRound).toBe(0);
    expect(snapshot.currentBet).toBe(10);
    expect(snapshot.players.reduce((sum, player) => sum + Number(player.totalInvested ?? 0), 0)).toBe(15);
    expect(snapshot.dealerIdx).toBe(1);
  });
});
