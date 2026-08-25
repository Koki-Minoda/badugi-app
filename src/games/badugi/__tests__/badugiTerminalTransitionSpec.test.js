import { describe, expect, it } from "vitest";
import { BadugiGameController } from "../controller/BadugiGameController.js";
import { buildBadugiTerminalTransitionAudit } from "../auditBadugiTerminalTransition.js";

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

function seedFinalBetting(controller) {
  let state = controller.createNewHandState(controller.createInitialState(), {
    drawCardsForSeat: (seat) => hands[seat],
    nextDealerIdx: 0,
  });
  const snapshot = controller.getUiSnapshot(state);
  return controller.syncFromExternalState({
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
}

describe("Badugi terminal transition spec", () => {
  it("moves from final betting to terminal result without leaving an active actor", () => {
    const controller = createController();
    const seeded = seedFinalBetting(controller);

    const result = controller.applyAction(seeded, {
      seatIndex: 0,
      payload: { type: "check" },
    });

    expect(result.state.snapshot.phase).toBe("SHOWDOWN");
    expect(result.state.snapshot.lastHandResult).toBeTruthy();
    expect(result.state.snapshot.turn).toBeNull();
    expect(result.state.snapshot.nextTurn).toBeNull();
    expect(controller.getLegalActions(result.state, 0)).toEqual([]);
    expect(result.state.snapshot.lastHandResult.totalPot ?? result.state.snapshot.lastHandResult.pot).toBeGreaterThan(0);
  });

  it("starts the next hand only after terminal result with fresh blind commitments", () => {
    const controller = createController();
    const seeded = seedFinalBetting(controller);
    const terminal = controller.applyAction(seeded, {
      seatIndex: 0,
      payload: { type: "check" },
    });

    const next = controller.createNewHandState(terminal.state, {
      drawCardsForSeat: (seat) => hands[seat],
    });
    const snapshot = controller.getUiSnapshot(next);

    expect(snapshot.phase).toBe("BET");
    expect(snapshot.drawRound).toBe(0);
    expect(snapshot.currentBet).toBe(10);
    expect(snapshot.turn).not.toBeNull();
    expect(snapshot.players.reduce((sum, player) => sum + Number(player.totalInvested ?? 0), 0)).toBe(15);
  });

  it("reports terminal transition audit as passing", () => {
    const report = buildBadugiTerminalTransitionAudit();

    expect(report.summary.status).toBe("PASS");
    expect(report.checks.filter((entry) => !entry.passed)).toEqual([]);
  });
});
