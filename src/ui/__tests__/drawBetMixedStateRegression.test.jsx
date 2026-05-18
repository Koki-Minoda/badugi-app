import { describe, expect, it } from "vitest";
import { assertNoMixedDrawBetState } from "../qa/assertNoMixedDrawBetState.js";

describe("draw/bet mixed state detector", () => {
  it("flags draw controls during BET", () => {
    const result = assertNoMixedDrawBetState({
      phase: "BET",
      ui: {
        visibleActions: ["action-draw-selected"],
        drawControlsVisible: true,
      },
      controller: { currentBet: 0 },
    });

    expect(result.violations.map((violation) => violation.type)).toContain("DRAW_BET_MIXED_STATE");
    expect(result.violations[0].severity).toBe("P0");
  });

  it("flags betting controls during DRAW", () => {
    const result = assertNoMixedDrawBetState({
      phase: "DRAW",
      ui: {
        visibleActions: ["action-call", "action-raise"],
        bettingControlsVisible: true,
      },
      controller: { currentBet: 20 },
    });

    expect(result.violations.map((violation) => violation.type)).toContain("DRAW_BET_MIXED_STATE");
  });

  it("allows phase-consistent controls", () => {
    expect(
      assertNoMixedDrawBetState({
        phase: "BET",
        ui: { visibleActions: ["action-call"], bettingControlsVisible: true },
        controller: { currentBet: 20 },
      }).violations,
    ).toEqual([]);
    expect(
      assertNoMixedDrawBetState({
        phase: "DRAW",
        ui: { visibleActions: ["action-draw-selected"], drawControlsVisible: true },
        controller: { currentBet: 0 },
      }).violations,
    ).toEqual([]);
  });
});
