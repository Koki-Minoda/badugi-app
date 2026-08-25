import { describe, expect, it } from "vitest";
import { AceToFiveSingleDrawController } from "../AceToFiveSingleDrawController.js";
import { AceToFiveTripleDrawController } from "../AceToFiveTripleDrawController.js";
import { DeuceToSevenSingleDrawController } from "../DeuceToSevenSingleDrawController.js";
import { DeuceToSevenTripleDrawController } from "../DeuceToSevenTripleDrawController.js";

const STRUCTURE = { sb: 10, bb: 20, ante: 0 };

function createHand(Controller, seatConfig, { dealerIndex = 0 } = {}) {
  const controller = new Controller({
    tableConfig: {
      seatConfig,
      dealerIndex,
      structure: STRUCTURE,
    },
  });
  const state = controller.createNewHandState({}, { dealerIndex, structure: STRUCTURE });
  return { controller, engineState: state.engineState };
}

function activeSeatCount(state) {
  return state.players.filter((player) => !player.sittingOut && !player.seatOut && !player.isBusted).length;
}

function nextEligibleSeat(players, startIndex, predicate) {
  for (let offset = 0; offset < players.length; offset += 1) {
    const seatIndex = (startIndex + offset) % players.length;
    if (predicate(players[seatIndex], seatIndex)) return seatIndex;
  }
  return null;
}

function expectedPredrawFirstActor(state) {
  const { sbIndex, bbIndex } = state.metadata.lastBlinds;
  if (activeSeatCount(state) === 2) return sbIndex;
  return nextEligibleSeat(
    state.players,
    (bbIndex + 1) % state.players.length,
    (player) => player && !player.folded && !player.sittingOut && !player.seatOut && !player.isBusted && !player.allIn,
  );
}

function expectedPostdrawFirstActor(state) {
  return nextEligibleSeat(
    state.players,
    (state.dealerIndex + 1) % state.players.length,
    (player) => player && !player.folded && !player.sittingOut && !player.seatOut && !player.isBusted && !player.allIn,
  );
}

describe("Triple Draw first actor regression", () => {
  it.each([
    ["6max", ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"], 3],
    ["5max", ["HUMAN", "CPU", "CPU", "CPU", "CPU"], 3],
    ["3way", ["HUMAN", "CPU", "CPU"], 0],
  ])("%s pre-draw first actor is left of BB, not BB", (_name, seatConfig, expectedActor) => {
    const { engineState } = createHand(DeuceToSevenTripleDrawController, seatConfig);

    expect(engineState.metadata.lastBlinds.bbIndex).toBe(2);
    expect(engineState.actingPlayerIndex).toBe(expectedActor);
    expect(engineState.actingPlayerIndex).not.toBe(engineState.metadata.lastBlinds.bbIndex);
    expect(engineState.actingPlayerIndex).toBe(expectedPredrawFirstActor(engineState));
  });

  it("heads-up pre-draw first actor is the button / small blind", () => {
    const { engineState } = createHand(DeuceToSevenTripleDrawController, ["HUMAN", "CPU"]);

    expect(engineState.dealerIndex).toBe(0);
    expect(engineState.metadata.lastBlinds.sbIndex).toBe(0);
    expect(engineState.metadata.lastBlinds.bbIndex).toBe(1);
    expect(engineState.actingPlayerIndex).toBe(0);
  });

  it("post-draw first actor is first active left of the button, and heads-up that is BB", () => {
    const { controller, engineState } = createHand(DeuceToSevenTripleDrawController, ["HUMAN", "CPU"]);
    const postDrawBet = controller.engine.transitionToBet({
      ...engineState,
      street: "DRAW",
      drawRoundIndex: 1,
    });

    expect(postDrawBet.actingPlayerIndex).toBe(1);
    expect(postDrawBet.actingPlayerIndex).toBe(expectedPostdrawFirstActor(postDrawBet));
  });

  it("post-draw skips folded and all-in seats", () => {
    const { controller, engineState } = createHand(
      DeuceToSevenTripleDrawController,
      ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"],
    );
    const drawState = {
      ...engineState,
      street: "DRAW",
      drawRoundIndex: 1,
      players: engineState.players.map((player, index) => ({
        ...player,
        folded: index === 1,
        allIn: index === 2,
      })),
    };
    const postDrawBet = controller.engine.transitionToBet(drawState);

    expect(postDrawBet.actingPlayerIndex).toBe(3);
  });

  it("no-next-alive transitions safely instead of leaving an impossible actor", () => {
    const { controller, engineState } = createHand(DeuceToSevenTripleDrawController, ["HUMAN", "CPU", "CPU"]);
    const drawState = {
      ...engineState,
      street: "DRAW",
      drawRoundIndex: 1,
      players: engineState.players.map((player) => ({
        ...player,
        allIn: true,
      })),
    };
    const next = controller.engine.transitionToBet(drawState);

    expect(next.actingPlayerIndex).not.toBe(0);
    expect(next.street === "DRAW" || next.street === "SHOWDOWN").toBe(true);
  });

  it.each([
    ["D01", DeuceToSevenTripleDrawController, "D01", 3],
    ["D02", AceToFiveTripleDrawController, "D02", 3],
    ["S01", DeuceToSevenSingleDrawController, "S01", 3],
    ["S02", AceToFiveSingleDrawController, "S02", 3],
  ])("%s mapping uses the same canonical pre-draw actor rule", (_label, Controller, variantId, expectedActor) => {
    const { engineState } = createHand(Controller, ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"]);

    expect(engineState.metadata.variantId).toBe(variantId);
    expect(engineState.actingPlayerIndex).toBe(expectedActor);
    expect(engineState.actingPlayerIndex).not.toBe(engineState.metadata.lastBlinds.bbIndex);
  });
});
