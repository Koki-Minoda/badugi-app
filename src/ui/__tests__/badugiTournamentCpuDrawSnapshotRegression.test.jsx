import { describe, expect, it } from "vitest";
import { assertBrowserGameplayInvariants } from "../qa/assertBrowserGameplayInvariants.js";
import { assertNoCrossVariantStateLeak } from "../qa/assertNoCrossVariantStateLeak.js";

const drawPlayers = [
  { seatIndex: 0, name: "Hero", stack: 4980, folded: false, hasDrawn: true, lastAction: "Pat" },
  { seatIndex: 1, name: "Mina", stack: 4980, folded: false, hasDrawn: true, lastAction: "Pat" },
  { seatIndex: 2, name: "Ren", stack: 4980, folded: false, hasDrawn: false, lastAction: "" },
  { seatIndex: 3, name: "Kai", stack: 0, folded: true, hasFolded: true, hasDrawn: true, lastAction: "Fold" },
];

describe("Badugi tournament CPU DRAW1 snapshot regression", () => {
  it("treats a Badugi DRAW1 CPU actor snapshot as valid UI/controller state", () => {
    const row = {
      variantId: "badugi",
      mode: "tournament",
      handId: "BADUGI-DRAW1-CPU-ACTION-001-snapshot",
      phase: "DRAW",
      drawRound: 1,
      betRound: 1,
      buttonSeat: 0,
      bbSeat: 2,
      controller: {
        actorSeat: 2,
        currentBet: 0,
        pot: 60,
        players: drawPlayers,
      },
      ui: {
        heroSeat: 0,
        heroControlsVisible: false,
        displayedPot: 60,
        displayedPhase: "DRAW",
        resultVisible: false,
        nextHandVisible: false,
      },
    };

    const result = assertBrowserGameplayInvariants(row, []);

    expect(result.status).toBe("PASS");
    expect(result.violations).toEqual([]);
  });

  it("does not classify minified Badugi controller snapshots as cross-variant contamination", () => {
    const audit = assertNoCrossVariantStateLeak({
      currentVariant: "badugi",
      nextVariant: "badugi",
      controllerVariantRef: "badugi",
      gameControllerVariantId: "badugi",
      controllerSnapshotVariantId: "D03",
      controllerClass: "O1",
      previousVariant: "D01",
      previousHandId: "d01-h1",
      newHandId: "badugi-h1",
    });

    expect(audit.status).toBe("PASS");
    expect(audit.violations).toEqual([]);
  });
});
