import { describe, expect, it } from "vitest";
import { BadugiGameController } from "../controller/BadugiGameController.js";
import { BadugiUIAdapter } from "../../../ui/game/badugi/BadugiUIAdapter.js";

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

function potTotal(snapshot) {
  return new BadugiUIAdapter({}).buildViewProps({
    controllerSnapshot: snapshot,
    tableConfig: { bbValue: 10, maxDraws: 3 },
  }).potView.total;
}

describe("Badugi long-run pot continuity spec", () => {
  it("preserves active pot through repeated street reset snapshots", () => {
    const controller = createController();
    let state = controller.createNewHandState(controller.createInitialState(), {
      drawCardsForSeat: (seat) => hands[seat],
      nextDealerIdx: 0,
    });

    for (let hand = 0; hand < 5; hand += 1) {
      const snapshot = controller.getUiSnapshot(state);
      expect(potTotal(snapshot)).toBeGreaterThan(0);

      for (let drawRound = 1; drawRound <= 3; drawRound += 1) {
        const resetStreet = {
          ...snapshot,
          phase: "BET",
          drawRound,
          currentBet: 0,
          pots: [],
          players: snapshot.players.map((player) => ({
            ...player,
            betThisRound: 0,
          })),
        };
        expect(potTotal(resetStreet)).toBeGreaterThan(0);
      }

      state = controller.createNewHandState(state, {
        drawCardsForSeat: (seat) => hands[seat],
      });
    }
  });

  it("does not require a table pot after terminal payout when lastHandResult carries the awarded pot", () => {
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
          totalInvested: 20,
          betThisRound: 0,
          hasActedThisRound: seat !== 0,
        })),
      },
      handIndex: state.handIndex,
      context: state.context,
    });

    const terminal = controller.applyAction(state, {
      seatIndex: 0,
      payload: { type: "check" },
    });

    expect(terminal.state.snapshot.phase).toBe("SHOWDOWN");
    expect(terminal.state.snapshot.lastHandResult.totalPot ?? terminal.state.snapshot.lastHandResult.pot).toBeGreaterThan(0);
    expect(controller.getLegalActions(terminal.state, 0)).toEqual([]);
  });
});
