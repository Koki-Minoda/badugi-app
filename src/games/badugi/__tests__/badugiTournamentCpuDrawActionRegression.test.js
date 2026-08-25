import { describe, expect, it } from "vitest";
import { BadugiGameController } from "../controller/BadugiGameController.js";

const blindStructure = [{ sb: 5, bb: 10, ante: 0, hands: 999 }];

function seat(overrides = {}) {
  return {
    name: overrides.name ?? "Seat",
    stack: overrides.stack ?? 5000,
    hand: overrides.hand ?? ["AS", "2H", "3C", "4D"],
    betThisRound: overrides.betThisRound ?? 0,
    bet: overrides.bet ?? overrides.betThisRound ?? 0,
    totalInvested: overrides.totalInvested ?? 20,
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

function buildTournamentDrawState() {
  const controller = new BadugiGameController({
    numSeats: 6,
    blindStructure,
    lastStructureIndex: 0,
  });
  const players = [
    seat({ name: "Hero", hasDrawn: true, lastAction: "Pat" }),
    seat({ name: "Mina", hasDrawn: true, lastAction: "Pat" }),
    seat({ name: "Ren", hasDrawn: false, lastAction: "" }),
    seat({ name: "Kai", folded: true, hasFolded: true, stack: 0, totalInvested: 0, lastAction: "Fold" }),
    seat({ name: "Ari", folded: true, hasFolded: true, stack: 0, totalInvested: 0, lastAction: "Fold" }),
    seat({ name: "Bo", folded: true, hasFolded: true, stack: 0, totalInvested: 0, lastAction: "Fold" }),
  ];
  const state = controller.syncFromExternalState({
    snapshot: {
      variantId: "badugi",
      handId: "BADUGI-DRAW1-CPU-ACTION-001-unit",
      phase: "DRAW",
      street: "DRAW",
      drawRound: 1,
      drawRoundIndex: 1,
      betRound: 1,
      dealerIdx: 0,
      currentBet: 0,
      betHead: null,
      lastAggressorIdx: null,
      turn: 2,
      nextTurn: 2,
      currentActor: 2,
      players,
      pots: [{ amount: 60, eligible: [0, 1, 2] }],
      metadata: {
        actingPlayerIndex: 2,
        currentBet: 0,
      },
    },
    handIndex: 1,
    context: { mode: "tournament" },
  });
  return { controller, state };
}

describe("Badugi tournament CPU DRAW1 action regression", () => {
  it("applies an eligible CPU draw action and returns a valid controller snapshot", () => {
    const { controller, state } = buildTournamentDrawState();
    const result = controller.applyAction(state, {
      seatIndex: 2,
      payload: { type: "draw", discardIndexes: [0, 1, 2] },
    });
    const invalid = result.events?.find((event) => event.type === "invalidAction");
    const snapshot = controller.getUiSnapshot(result.state);

    expect(invalid).toBeUndefined();
    expect(snapshot).toBeTruthy();
    expect(snapshot.players[2]).toMatchObject({
      lastDrawCount: 3,
      lastAction: "DRAW(3)",
    });
    expect(snapshot.phase).not.toBe("DRAW");
    expect(snapshot.turn ?? snapshot.nextTurn).not.toBe(2);
  });
});
