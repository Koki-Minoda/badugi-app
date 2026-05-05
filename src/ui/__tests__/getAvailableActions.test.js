import { describe, expect, it } from "vitest";
import getAvailableActions from "../utils/getAvailableActions.js";

describe("getAvailableActions", () => {
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
