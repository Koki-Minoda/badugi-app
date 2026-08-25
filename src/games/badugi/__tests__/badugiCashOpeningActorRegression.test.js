import { describe, expect, it } from "vitest";
import { GAME_VARIANTS } from "../../core/variants.js";

const seatConfig = ["HERO", "CPU", "CPU", "CPU", "CPU", "CPU"];
const blindStructure = [{ sb: 10, bb: 20, ante: 0 }];

function createBadugiCashController() {
  return GAME_VARIANTS.badugi.controllerFactory({
    seatConfig,
    startingStack: 600,
    blindStructure,
    lastStructureIndex: 0,
  });
}

function actorFrom(snapshot) {
  return snapshot?.turn ?? snapshot?.nextTurn ?? snapshot?.currentActor ?? null;
}

describe("Badugi cash opening actor regression", () => {
  it("elects first live seat after BB and applies the opening action", () => {
    const controller = createBadugiCashController();
    const initial = controller.createInitialState({ seatConfig });
    const state = controller.createNewHandState(initial, {
      seatConfig,
      nextDealerIdx: 0,
      blindStructure,
    });
    const opening = controller.getUiSnapshot(state);

    expect(opening.dealerIdx ?? opening.dealerSeat).toBe(0);
    expect(opening.players[1].betThisRound).toBe(10);
    expect(opening.players[2].betThisRound).toBe(20);
    expect(opening.currentBet).toBe(20);
    expect(actorFrom(opening)).toBe(3);

    const legalActions = controller.getLegalActions(state, 3).map((action) => action.type);
    expect(legalActions).toContain("FOLD");
    expect(legalActions).toContain("CALL");

    const { state: nextState, events } = controller.applyAction(state, {
      seatIndex: 3,
      payload: { type: "call", amount: 20 },
    });
    const invalid = events.find((event) => event.type === "invalidAction");
    expect(invalid).toBeUndefined();

    const after = controller.getUiSnapshot(nextState);
    expect(after.players[3].hasActedThisRound).toBe(true);
    expect(after.players[3].betThisRound).toBe(20);
    expect(actorFrom(after)).toBe(4);
    expect(after.phase).toBe("BET");
  });

  it("keeps the synced controller snapshot aligned with opening actor state", () => {
    const controller = createBadugiCashController();
    const initial = controller.createInitialState({ seatConfig });
    const state = controller.createNewHandState(initial, {
      seatConfig,
      nextDealerIdx: 0,
      blindStructure,
    });
    const opening = controller.getUiSnapshot(state);
    const synced = controller.syncFromExternalState({
      snapshot: opening,
      context: state.context,
      handIndex: state.handIndex,
    });
    const syncedSnapshot = controller.getUiSnapshot(synced);

    expect(syncedSnapshot.handId).toBe(opening.handId);
    expect(actorFrom(syncedSnapshot)).toBe(3);
    expect(controller.getLegalActions(synced, 3).map((action) => action.type)).toContain("CALL");
  });
});
