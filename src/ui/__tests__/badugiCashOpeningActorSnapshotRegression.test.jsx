import { describe, expect, it } from "vitest";
import { GAME_VARIANTS } from "../../games/core/variants.js";
import { assertBrowserGameplayInvariants } from "../qa/assertBrowserGameplayInvariants.js";
import {
  resolveCanonicalActionSeat,
  shouldSyncLegacyTurnToController,
} from "../utils/actorSourceOfTruth.js";

const players = Array.from({ length: 6 }, (_, seat) => ({
  seatIndex: seat,
  name: seat === 0 ? "You" : `CPU ${seat + 1}`,
  stack: seat === 1 ? 590 : seat === 2 ? 580 : 600,
  betThisRound: seat === 1 ? 10 : seat === 2 ? 20 : 0,
  totalInvested: seat === 1 ? 10 : seat === 2 ? 20 : 0,
  folded: false,
  allIn: false,
  seatOut: false,
  hasActedThisRound: seat === 1 || seat === 2,
}));

describe("Badugi cash opening actor UI snapshot regression", () => {
  it("does not expose hero controls while CPU UTG is the canonical opening actor", () => {
    const row = {
      variantId: "badugi",
      mode: "cash",
      handId: "BADUGI-CASH-OPENING-ACTOR-001-snapshot",
      phase: "BET",
      drawRound: 0,
      betRound: 0,
      buttonSeat: 0,
      sbSeat: 1,
      bbSeat: 2,
      controller: {
        actorSeat: 3,
        nextTurn: 3,
        currentBet: 20,
        pot: 30,
        playersNeedingAction: [3, 4, 5, 0],
        players,
      },
      ui: {
        heroSeat: 0,
        actingBadgeSeat: 3,
        heroControlsVisible: false,
        displayedPot: 30,
        displayedPhase: "BET",
        resultVisible: false,
        nextHandVisible: false,
      },
    };

    const result = assertBrowserGameplayInvariants(row, []);

    expect(result.status).toBe("PASS");
    expect(result.violations).toEqual([]);
  });

  it("keeps CPU auto progression on the controller actor when legacy turn is stale", () => {
    const controller = GAME_VARIANTS.badugi.controllerFactory({
      seatConfig: ["HERO", "CPU", "CPU", "CPU", "CPU", "CPU"],
      startingStack: 600,
      blindStructure: [{ sb: 10, bb: 20, ante: 0 }],
      lastStructureIndex: 0,
    });
    const initial = controller.createInitialState({
      seatConfig: ["HERO", "CPU", "CPU", "CPU", "CPU", "CPU"],
    });
    const state = controller.createNewHandState(initial, {
      seatConfig: ["HERO", "CPU", "CPU", "CPU", "CPU", "CPU"],
      nextDealerIdx: 0,
      blindStructure: [{ sb: 10, bb: 20, ante: 0 }],
    });
    const opening = controller.getUiSnapshot(state);
    const controllerTurn = opening.currentActor ?? opening.turn ?? opening.nextTurn;
    const legacyTurn = 0;

    expect(controllerTurn).toBe(3);
    expect(
      resolveCanonicalActionSeat({
        phase: "BET",
        controllerTurn,
        legacyTurn,
        players: opening.players,
      }),
    ).toBe(3);
    expect(
      shouldSyncLegacyTurnToController({
        phase: "BET",
        controllerTurn,
        legacyTurn,
        players: opening.players,
      }),
    ).toBe(true);

    const { state: nextState, events } = controller.applyAction(state, {
      seatIndex: controllerTurn,
      payload: { type: "call", amount: 20 },
    });
    expect(events.find((event) => event.type === "invalidAction")).toBeUndefined();

    const after = controller.getUiSnapshot(nextState);
    expect(after.players[3].hasActedThisRound).toBe(true);
    expect(after.players[3].betThisRound).toBe(20);
    expect(after.currentActor ?? after.turn ?? after.nextTurn).toBe(4);
  });
});
