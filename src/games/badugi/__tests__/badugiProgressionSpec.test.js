import { describe, expect, it } from "vitest";
import { BadugiGameController } from "../controller/BadugiGameController.js";
import { buildBadugiProgressionRuleAudit } from "../auditBadugiProgressionRules.js";

const blinds = [{ sb: 5, bb: 10, ante: 0, hands: 999 }];
const hands = [
  ["AS", "2H", "3C", "4D"],
  ["2S", "3H", "4C", "5D"],
  ["3S", "4H", "5C", "6D"],
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

function markBetRoundComplete(controller, drawRound) {
  controller.legacy.state.players = controller.legacy.state.players.map((player) => ({
    ...player,
    betThisRound: 0,
    hasActedThisRound: Boolean(player.folded || player.seatOut || player.allIn) || true,
    lastAction: player.folded ? "Fold" : "Check",
  }));
  controller.legacy.state.currentBet = 0;
  controller.legacy.state.drawRound = drawRound;
  controller.legacy.state.phase = "BET";
}

function markDrawRoundComplete(controller) {
  controller.legacy.state.players = controller.legacy.state.players.map((player) => ({
    ...player,
    hasDrawn: true,
    hasActedThisRound: true,
  }));
}

describe("Badugi progression spec", () => {
  it("audits focused progression rules without mutating production routing", () => {
    const report = buildBadugiProgressionRuleAudit();

    expect(report.variant).toBe("badugi");
    expect(report.availability).toBe("preview_only");
    expect(report.promoted).toBe(false);
    expect(report.routingChanged).toBe(false);
    expect(report.summary.failed).toBe(0);
  });

  it("progresses focused hand through three draws and final showdown", () => {
    const controller = createController();
    let state = controller.createNewHandState(controller.createInitialState(), {
      drawCardsForSeat: (seat) => hands[seat],
      nextDealerIdx: 0,
    });
    const sequence = [];

    for (let drawRound = 0; drawRound < 3; drawRound += 1) {
      sequence.push(`${controller.getUiSnapshot(state).phase}:${controller.getUiSnapshot(state).drawRound}`);
      markBetRoundComplete(controller, drawRound);
      controller._finishBetRound();
      state = controller._buildControllerState({ handIndex: state.handIndex, context: state.context });
      sequence.push(`${controller.getUiSnapshot(state).phase}:${controller.getUiSnapshot(state).drawRound}`);

      markDrawRoundComplete(controller);
      controller._finishDrawRound(controller.legacy.state.players, controller.legacy.state.dealerIdx ?? 0);
      state = controller._buildControllerState({ handIndex: state.handIndex, context: state.context });
    }

    sequence.push(`${controller.getUiSnapshot(state).phase}:${controller.getUiSnapshot(state).drawRound}`);
    markBetRoundComplete(controller, 3);
    controller._finishBetRound();
    state = controller._buildControllerState({ handIndex: state.handIndex, context: state.context });
    sequence.push(`${controller.getUiSnapshot(state).phase}:${controller.getUiSnapshot(state).drawRound}`);

    expect(sequence).toEqual([
      "BET:0",
      "DRAW:0",
      "BET:1",
      "DRAW:1",
      "BET:2",
      "DRAW:2",
      "BET:3",
      "SHOWDOWN:3",
    ]);
    expect(controller.getUiSnapshot(state).lastHandResult).toBeTruthy();
  });

  it("closes a check-around street without selecting an invalid actor", () => {
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
        drawRound: 1,
        currentBet: 0,
        nextTurn: 0,
        turn: 0,
        players: snapshot.players.map((player, seat) => ({
          ...player,
          betThisRound: 0,
          hasActedThisRound: seat !== 0,
          lastAction: seat === 0 ? "" : "Check",
        })),
      },
      handIndex: state.handIndex,
      context: state.context,
    });

    const result = controller.applyAction(seeded, {
      seatIndex: 0,
      payload: { type: "check" },
    });

    expect(result.events.some((event) => event.type === "betRoundComplete")).toBe(true);
    expect(result.state.snapshot.phase).toBe("DRAW");
    expect(result.state.snapshot.nextTurn).not.toBe(0);
  });

  it("closes a call-around street when all live bets are matched", () => {
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
        drawRound: 1,
        currentBet: 10,
        nextTurn: 0,
        turn: 0,
        players: snapshot.players.map((player, seat) => ({
          ...player,
          betThisRound: seat === 0 ? 0 : 10,
          hasActedThisRound: seat !== 0,
          lastAction: seat === 0 ? "" : "Call",
        })),
      },
      handIndex: state.handIndex,
      context: state.context,
    });

    const result = controller.applyAction(seeded, {
      seatIndex: 0,
      payload: { type: "call", amount: 10 },
    });

    expect(result.events.some((event) => event.type === "betRoundComplete")).toBe(true);
    expect(result.state.snapshot.phase).toBe("DRAW");
  });
});
