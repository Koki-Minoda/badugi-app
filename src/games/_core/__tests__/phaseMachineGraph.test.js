import { describe, expect, it } from "vitest";
import { assertLegalPhaseTransition } from "../assertLegalPhaseTransition.js";
import { getCore5MaxDrawRounds, isLegalPhaseTransition } from "../phaseMachineGraph.js";

describe("Core5 phase machine graph", () => {
  it("allows normal draw-game transitions", () => {
    expect(isLegalPhaseTransition("HAND_START", "POST_BLINDS")).toBe(true);
    expect(isLegalPhaseTransition("POST_BLINDS", "BET")).toBe(true);
    expect(isLegalPhaseTransition("BET", "DRAW")).toBe(true);
    expect(isLegalPhaseTransition("DRAW", "BET")).toBe(true);
    expect(isLegalPhaseTransition("BET", "SHOWDOWN")).toBe(true);
    expect(isLegalPhaseTransition("BET", "COLLECT")).toBe(true);
    expect(isLegalPhaseTransition("COLLECT", "RESULT")).toBe(true);
    expect(isLegalPhaseTransition("RESULT", "NEXT_HAND")).toBe(true);
  });

  it("rejects impossible terminal regressions", () => {
    expect(isLegalPhaseTransition("SHOWDOWN", "DRAW")).toBe(false);
    expect(isLegalPhaseTransition("COLLECT", "BET")).toBe(false);
  });

  it("rejects terminal actor and draw round overflow", () => {
    expect(
      assertLegalPhaseTransition(null, {
        variantId: "S01",
        phase: "DRAW",
        drawRound: 2,
        actorSeat: 0,
      }).violations.map((violation) => violation.type),
    ).toContain("ILLEGAL_DRAW_SEQUENCE");

    expect(
      assertLegalPhaseTransition(null, {
        variantId: "D01",
        phase: "RESULT",
        actorSeat: 0,
      }).violations.map((violation) => violation.type),
    ).toContain("TERMINAL_WITH_ACTOR");
  });

  it("tracks Core5 draw limits", () => {
    expect(getCore5MaxDrawRounds("badugi")).toBe(3);
    expect(getCore5MaxDrawRounds("D01")).toBe(3);
    expect(getCore5MaxDrawRounds("D02")).toBe(3);
    expect(getCore5MaxDrawRounds("S01")).toBe(1);
    expect(getCore5MaxDrawRounds("S02")).toBe(1);
  });
});
