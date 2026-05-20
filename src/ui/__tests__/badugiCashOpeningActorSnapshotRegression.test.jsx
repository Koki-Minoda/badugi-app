import { describe, expect, it } from "vitest";
import { assertBrowserGameplayInvariants } from "../qa/assertBrowserGameplayInvariants.js";

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
});
