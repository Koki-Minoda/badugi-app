import { describe, expect, it } from "vitest";
import { BadugiGameController } from "../controller/BadugiGameController.js";
import { buildBadugiBetToDrawTransitionTrace } from "../auditBadugiBetToDrawTransition.js";

const blindStructure = [{ sb: 5, bb: 10, ante: 0, hands: 999 }];

function seat(overrides = {}) {
  return {
    name: overrides.name ?? "Seat",
    stack: overrides.stack ?? 500,
    hand: overrides.hand ?? ["AS", "2H", "3C", "4D"],
    betThisRound: overrides.betThisRound ?? 0,
    bet: overrides.bet ?? overrides.betThisRound ?? 0,
    totalInvested: overrides.totalInvested ?? overrides.betThisRound ?? 0,
    hasActedThisRound: overrides.hasActedThisRound ?? false,
    hasDrawn: overrides.hasDrawn ?? false,
    lastAction: overrides.lastAction ?? "",
    folded: overrides.folded ?? false,
    hasFolded: overrides.hasFolded ?? overrides.folded ?? false,
    seatOut: overrides.seatOut ?? false,
    isBusted: overrides.isBusted ?? false,
    isActiveInGame: overrides.isActiveInGame ?? true,
    allIn: overrides.allIn ?? false,
  };
}

function controllerWithSnapshot(snapshot) {
  const controller = new BadugiGameController({
    numSeats: snapshot.players.length,
    blindStructure,
    lastStructureIndex: 0,
  });
  const state = controller.syncFromExternalState({
    snapshot: {
      phase: "BET",
      street: "BET",
      drawRound: 1,
      betRound: 1,
      dealerIdx: 0,
      currentBet: 20,
      betHead: 0,
      lastAggressorIdx: 0,
      turn: 2,
      nextTurn: 2,
      ...snapshot,
    },
    handIndex: 5,
    context: { mode: "tournament" },
  });
  return { controller, state };
}

describe("Badugi tournament BET to DRAW transition regression", () => {
  it("enters DRAW when all remaining betting seats have called or folded", () => {
    const players = [
      seat({ name: "Hero", betThisRound: 20, hasActedThisRound: true, lastAction: "Bet" }),
      seat({ name: "Folded", folded: true, hasFolded: true, hasActedThisRound: true, lastAction: "Fold" }),
      seat({ name: "Caller", betThisRound: 0, hasActedThisRound: false }),
      seat({ name: "Folded 2", folded: true, hasFolded: true, hasActedThisRound: true, lastAction: "Fold" }),
      seat({ name: "Caller 2", betThisRound: 20, hasActedThisRound: true, lastAction: "Call" }),
      seat({ name: "Folded 3", folded: true, hasFolded: true, hasActedThisRound: true, lastAction: "Fold" }),
    ];
    const { controller, state } = controllerWithSnapshot({ players });
    const result = controller.applyAction(state, {
      seatIndex: 2,
      payload: { type: "call" },
    });
    const snapshot = controller.getUiSnapshot(result.state);

    expect(result.events.some((event) => event.type === "betRoundComplete")).toBe(true);
    expect(snapshot.phase).toBe("DRAW");
    expect(snapshot.drawRound).toBe(1);
    expect(snapshot.turn ?? snapshot.nextTurn).not.toBe(1);
    expect(snapshot.players[1].folded).toBe(true);
  });

  it("does not wait on all-in players for BET closure, but preserves their DRAW decision", () => {
    const players = [
      seat({ name: "Hero", betThisRound: 20, hasActedThisRound: true, lastAction: "Bet" }),
      seat({
        name: "All-in draw seat",
        stack: 0,
        allIn: true,
        betThisRound: 20,
        hasActedThisRound: true,
        hasDrawn: false,
        lastAction: "Call",
      }),
      seat({ name: "Caller", betThisRound: 0, hasActedThisRound: false }),
      seat({ name: "Folded", folded: true, hasFolded: true, hasActedThisRound: true, lastAction: "Fold" }),
    ];
    const { controller, state } = controllerWithSnapshot({ players });
    const result = controller.applyAction(state, {
      seatIndex: 2,
      payload: { type: "call" },
    });
    const snapshot = controller.getUiSnapshot(result.state);

    expect(result.events.some((event) => event.type === "betRoundComplete")).toBe(true);
    expect(snapshot.phase).toBe("DRAW");
    expect(snapshot.players[1]).toMatchObject({
      allIn: true,
      hasDrawn: false,
      hasActedThisRound: false,
    });
    expect(snapshot.turn ?? snapshot.nextTurn).toBe(1);
  });

  it("records a P0 trace row when a closed BET round remains in BET", () => {
    const players = [
      seat({ name: "Hero", betThisRound: 21, hasActedThisRound: true, lastAction: "Call" }),
      seat({ name: "Mina", folded: true, hasFolded: true, hasActedThisRound: true, lastAction: "Fold" }),
      seat({ name: "Ren", folded: true, hasFolded: true, hasActedThisRound: true, lastAction: "Fold" }),
    ];
    const row = buildBadugiBetToDrawTransitionTrace({
      before: {
        handId: "physical-freeze-like",
        phase: "BET",
        drawRound: 2,
        betRound: 2,
        currentBet: 21,
        pot: 66,
        turn: null,
        nextTurn: null,
        players,
      },
      after: {
        phase: "BET",
        drawRound: 2,
        pot: 66,
      },
      mode: "tournament",
      closeReason: "all_matched_or_folded",
      transitionCalled: false,
      transitionResult: null,
    });

    expect(row.shouldCloseBetRound).toBe(true);
    expect(row.expectedNextPhase).toBe("DRAW");
    expect(row.actualNextPhase).toBe("BET");
    expect(row.playersNeedingAction).toEqual([]);
  });
});
