import { describe, expect, it } from "vitest";
import {
  applySoakViolationStability,
  evaluateSoakSnapshot,
} from "../invariants.js";

function row(overrides = {}) {
  return {
    variantId: "D01",
    handId: "hand-1",
    actionIndex: 1,
    phase: "BET",
    drawRound: 0,
    betRound: 1,
    controller: {
      actorSeat: 1,
      nextTurn: 1,
      currentBet: 20,
      pot: 30,
      players: [
        { stack: 500, hand: ["AC", "2D", "3H", "4S", "5C"] },
        { stack: 480, hand: ["6C", "7D", "8H", "9S", "TC"] },
      ],
    },
    ui: {
      heroSeat: 0,
      heroControlsVisible: false,
      visibleActions: [],
      displayedPhase: "BET R1",
      resultVisible: false,
    },
    ...overrides,
  };
}

describe("gameplay soak invariant classification", () => {
  it("does not fail terminal or no-actor transition states", () => {
    const assertion = evaluateSoakSnapshot(row({
      phase: "TOURNAMENT_COMPLETE",
      controller: {
        actorSeat: null,
        nextTurn: null,
        currentBet: 0,
        pot: 30,
        players: [
          { stack: 530, hand: ["AC", "2D", "3H", "4S", "5C"] },
          { stack: 470, hand: ["6C", "7D", "8H", "9S", "TC"] },
        ],
      },
      ui: {
        heroSeat: 0,
        heroControlsVisible: false,
        visibleActions: [],
        displayedPhase: "Tournament Complete",
        resultVisible: true,
      },
    }));

    expect(assertion.status).not.toBe("FAIL");
    expect(assertion.violations.some((violation) => violation.severity === "P0")).toBe(false);
  });

  it("still fails repeated actionable BET actor mismatches", () => {
    const snapshot = row({
      controller: {
        actorSeat: 1,
        nextTurn: 1,
        currentBet: 20,
        pot: 30,
        players: [
          { stack: 500, hand: ["AC", "2D", "3H", "4S", "5C"], betThisRound: 0, hasActedThisRound: false },
          { stack: 480, hand: ["6C", "7D", "8H", "9S", "TC"], folded: true, betThisRound: 20, hasActedThisRound: true },
        ],
      },
      ui: {
        heroSeat: 0,
        heroControlsVisible: true,
        visibleActions: ["action-call"],
        displayedPhase: "BET R1",
      },
    });
    const assertion = evaluateSoakSnapshot(snapshot);
    const stability = {};
    const first = applySoakViolationStability(snapshot, assertion.violations, stability, { controlMismatchThreshold: 2 });
    const second = applySoakViolationStability(snapshot, assertion.violations, stability, { controlMismatchThreshold: 2 });

    expect(assertion.status).toBe("FAIL");
    expect(first.some((violation) => violation.type === "ACTOR" && violation.severity === "P0")).toBe(false);
    expect(second.some((violation) => violation.type === "ACTOR" && violation.severity === "P0")).toBe(true);
  });

  it("does not immediately fail a single transient control mismatch", () => {
    const stability = {};
    const violation = { type: "BET_CONTROLS", severity: "P0", message: "draw controls are visible during BET" };
    const first = applySoakViolationStability(row(), [violation], stability, { controlMismatchThreshold: 2 });
    const second = applySoakViolationStability(row(), [violation], stability, { controlMismatchThreshold: 2 });

    expect(first[0]).toMatchObject({
      severity: "P1",
      classification: "control_mismatch",
      transientCount: 1,
    });
    expect(second[0]).toMatchObject({
      severity: "P0",
      classification: "control_mismatch",
      transientCount: 2,
    });
  });

  it("keeps repeated same-state FREEZE violations actionable", () => {
    const stable = applySoakViolationStability(
      row(),
      [{ type: "FREEZE", severity: "P0", message: "same gameplay state repeated 7 times" }],
      {},
    );

    expect(stable[0]).toMatchObject({
      severity: "P0",
      classification: "true_freeze",
    });
  });
});
