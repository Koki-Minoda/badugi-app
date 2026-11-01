import { expect, it } from "vitest";
import { DeuceToSevenSingleDrawEngine } from "../DeuceToSevenSingleDrawEngine.js";

it("calls rather than raising when a strong S01 hand has only the call amount left", () => {
  const engine = new DeuceToSevenSingleDrawEngine();
  const state = engine.applyForcedBets(engine.initHand({
    seatConfig: ["HUMAN", "CPU", "CPU"],
    startingStack: 100,
    dealerIndex: 0,
    structure: { sb: 1, bb: 2 },
  }));
  const seatIndex = state.actingPlayerIndex;
  state.players[seatIndex].hand = ["2S", "3H", "4D", "5C", "7S"];
  state.players[seatIndex].stack = 2;

  const action = engine.chooseCpuAction(state, seatIndex);

  expect(action.type).toBe("CALL");
  expect(() => engine.applyBettingAction(state, action)).not.toThrow();
});

it("does not reopen a no-limit raise for a player who already acted", () => {
  const engine = new DeuceToSevenSingleDrawEngine();
  const state = engine.applyForcedBets(engine.initHand({
    seatConfig: ["HUMAN", "CPU", "CPU"],
    startingStack: 100,
    dealerIndex: 0,
    structure: { sb: 1, bb: 2 },
  }));
  const seatIndex = state.actingPlayerIndex;
  state.players[seatIndex].hand = ["2S", "3H", "4D", "5C", "7S"];
  state.players[seatIndex].hasActedThisRound = true;

  expect(engine.chooseCpuAction(state, seatIndex).type).toBe("CALL");
});

it("still permits a legal short all-in raise above the call amount", () => {
  const engine = new DeuceToSevenSingleDrawEngine();
  const state = engine.applyForcedBets(engine.initHand({
    seatConfig: ["HUMAN", "CPU", "CPU"],
    startingStack: 100,
    dealerIndex: 0,
    structure: { sb: 1, bb: 2 },
  }));
  const seatIndex = state.actingPlayerIndex;
  state.players[seatIndex].hand = ["2S", "3H", "4D", "5C", "7S"];
  state.players[seatIndex].stack = 3;

  const action = engine.chooseCpuAction(state, seatIndex);
  expect(action.type).toBe("RAISE");
  expect(() => engine.applyBettingAction(state, action)).not.toThrow();
});
