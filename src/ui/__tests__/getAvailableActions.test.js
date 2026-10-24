import { describe, expect, it } from "vitest";
import getAvailableActions from "../utils/getAvailableActions.js";

describe("getAvailableActions", () => {
  it.each([64, 100])("offers only a payable all-in call and fold with stack %i", (stack) => {
    const actions = getAvailableActions({currentBet: 200, player: {stack, betThisRound: 100}});
    expect(actions.map(action => action.key)).toEqual(["ALLIN_CALL", "FOLD"]);
    expect(actions[0].label).toBe(`All-in (Call ${stack})`);
  });
  it("retains a raise when stack exceeds the call", () => {
    const actions = getAvailableActions({currentBet: 200, player: {stack: 101, betThisRound: 100}});
    expect(actions.map(action => action.key)).toEqual(["CALL", "RAISE", "FOLD"]);
  });
  it("does not offer a zero-chip raise when checking", () => {
    const actions = getAvailableActions({player: {stack: 0}});
    expect(actions.map(action => action.key)).not.toContain("RAISE");
  });
  const readyPlayer = {
    stack: 200,
    betThisRound: 20,
    folded: false,
    allIn: false,
    seatOut: false,
  };

  it("hides raise when a fixed-limit cap is reached while facing a bet", () => {
    const actions = getAvailableActions({
      currentBet: 40,
      player: readyPlayer,
      canRaise: false,
    });

    expect(actions.map((action) => action.key)).toEqual(["CALL", "FOLD"]);
  });

  it("hides raise when a fixed-limit cap is reached and only check is available", () => {
    const actions = getAvailableActions({
      currentBet: 20,
      player: readyPlayer,
      canRaise: false,
    });

    expect(actions.map((action) => action.key)).toEqual(["CHECK", "FOLD"]);
  });
});
