import { describe, expect, it } from "vitest";
import { assertBrowserGameplayInvariants } from "../assertBrowserGameplayInvariants.js";

function openingBlindSnapshot(displayedPot) {
  return {
    phase: "BET",
    drawRound: 0,
    buttonSeat: 5,
    bbSeat: 1,
    controller: {
      actorSeat: 2,
      currentBet: 10,
      pot: 0,
      players: [
        { betThisRound: 5, stack: 4995 },
        { betThisRound: 10, stack: 4990 },
        { betThisRound: 0, stack: 5000 },
      ],
    },
    ui: {
      heroSeat: 2,
      heroControlsVisible: true,
      displayedPot,
      displayedPhase: "BET | R1",
    },
  };
}

describe("assertBrowserGameplayInvariants pot accounting", () => {
  it("accepts opening blinds held outside the controller settled pot", () => {
    const result = assertBrowserGameplayInvariants(openingBlindSnapshot(15));

    expect(result.violations.filter((violation) => violation.severity === "P0")).toEqual([]);
  });

  it("blocks a hand when invested chips disappear from the displayed total", () => {
    const result = assertBrowserGameplayInvariants(openingBlindSnapshot(0));

    expect(result.violations).toContainEqual(
      expect.objectContaining({
        type: "POT",
        severity: "P0",
        investedThisRound: 15,
        displayedPot: 0,
      }),
    );
  });
});
