import { describe, expect, it } from "vitest";
import { assertNoStalePhaseMerge } from "../qa/assertNoStalePhaseMerge.js";

describe("stale phase merge detector", () => {
  it("flags merged phase overriding controller phase", () => {
    const result = assertNoStalePhaseMerge({
      phase: "DRAW",
      ui: { displayedPhase: "DRAW" },
      mergeSource: {
        controller: { source: "state.controllerSnapshot", phase: "BET", actor: 1, drawRound: 2 },
        session: { phase: "DRAW", actor: 1, drawRound: 2 },
        legacy: { phase: "DRAW", actor: 1, drawRound: 2 },
        mergedPhase: "DRAW",
        mergedActor: 1,
        chosenSourcePriority: "legacy.phaseState.turn",
      },
    });

    expect(result.violations.map((violation) => violation.type)).toContain("STALE_PHASE_MERGE");
    expect(result.violations[0].severity).toBe("P0");
  });

  it("flags merged actor overriding controller actor", () => {
    const result = assertNoStalePhaseMerge({
      phase: "BET",
      ui: { displayedPhase: "BET" },
      mergeSource: {
        controller: { source: "state.controllerSnapshot", phase: "BET", actor: 2, drawRound: 1 },
        session: { phase: "BET", actor: 0, drawRound: 1 },
        legacy: { phase: "BET", actor: 0, drawRound: 1 },
        mergedPhase: "BET",
        mergedActor: 0,
        chosenSourcePriority: "legacy.state.turn",
      },
    });

    expect(result.violations.map((violation) => violation.type)).toContain("STALE_PHASE_MERGE");
  });

  it("allows controller-consistent merge", () => {
    expect(
      assertNoStalePhaseMerge({
        phase: "BET",
        ui: { displayedPhase: "BET" },
        mergeSource: {
          controller: { source: "state.controllerSnapshot", phase: "BET", actor: 1, drawRound: 0 },
          session: { phase: "BET", actor: 1, drawRound: 0 },
          legacy: { phase: "BET", actor: 1, drawRound: 0 },
          mergedPhase: "BET",
          mergedActor: 1,
          chosenSourcePriority: "controller.turn",
        },
      }).violations,
    ).toEqual([]);
  });

  it("does not classify displayed phase lag as stale merge", () => {
    const result = assertNoStalePhaseMerge({
      phase: "BET",
      ui: { displayedPhase: "DRAW" },
      mergeSource: {
        controller: { source: "state.controllerSnapshot", phase: "BET", actor: 1, drawRound: 1 },
        session: { phase: "BET", actor: 1, drawRound: 1 },
        legacy: { phase: "BET", actor: 1, drawRound: 1 },
        mergedPhase: "BET",
        mergedActor: 1,
        chosenSourcePriority: "controller.turn",
      },
    });

    expect(result.violations).toEqual([]);
  });
});
