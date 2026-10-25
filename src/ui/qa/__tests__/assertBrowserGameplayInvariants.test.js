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

    expect(result.violations.filter((violation) => violation.type === "POT")).toEqual([]);
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

  it("reports a pot value that matches neither settled nor committed chips", () => {
    const result = assertBrowserGameplayInvariants(openingBlindSnapshot(12));
    expect(result.violations).toContainEqual(expect.objectContaining({
      type: "POT", severity: "P1", controllerPot: 0,
      investedThisRound: 15, displayedPot: 12,
    }));
  });

  it("accepts an in-flight display between settled and cumulative commitments", () => {
    const row = openingBlindSnapshot(70);
    row.controller.pot = 30;
    row.controller.players = [
      { totalInvested: 20 }, { totalInvested: 30 }, { totalInvested: 40 },
    ];
    expect(assertBrowserGameplayInvariants(row).violations.filter((v) => v.type === "POT")).toEqual([]);
    row.ui.displayedPot = 100;
    expect(assertBrowserGameplayInvariants(row).violations).toContainEqual(
      expect.objectContaining({ type: "POT", severity: "P1", cumulativeInvested: 90 }),
    );
  });

  it("requires the final displayed pot to equal cumulative commitments", () => {
    const row = openingBlindSnapshot(70);
    row.phase = "HAND_RESULT";
    row.controller.actorSeat = null;
    row.controller.players = [{ totalInvested: 50 }, { totalInvested: 40 }];
    row.ui.resultVisible = true;
    expect(assertBrowserGameplayInvariants(row).violations).toContainEqual(
      expect.objectContaining({ type: "POT", severity: "P1", cumulativeInvested: 90 }),
    );
    row.ui.displayedPot = 90;
    expect(assertBrowserGameplayInvariants(row).violations.filter((v) => v.type === "POT")).toEqual([]);
  });

  it("checks the result summary after an uncalled bet is returned", () => {
    const row = openingBlindSnapshot(960);
    row.phase = "HAND_RESULT";
    row.controller.actorSeat = null;
    row.controller.resultPot = 960;
    row.controller.players = Array.from({ length: 5 }, () => ({ totalInvested: 200 }));
    row.ui.resultVisible = true;
    expect(assertBrowserGameplayInvariants(row).violations.filter((v) => v.type === "POT")).toEqual([]);
    row.ui.displayedPot = 920;
    expect(assertBrowserGameplayInvariants(row).violations).toContainEqual(
      expect.objectContaining({ type: "POT", severity: "P1", resultPot: 960 }),
    );
  });

  it("recognizes the Japanese bet and draw phase badges", () => {
    const row = openingBlindSnapshot(15);
    row.ui.displayedPhase = "ベット 1";
    expect(assertBrowserGameplayInvariants(row).violations.filter((v) => v.type === "PHASE")).toEqual([]);
    row.phase = "DRAW";
    row.ui.displayedPhase = "交換 1/3";
    expect(assertBrowserGameplayInvariants(row).violations.filter((v) => v.type === "PHASE")).toEqual([]);
  });
});
