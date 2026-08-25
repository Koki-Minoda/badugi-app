import { describe, expect, it } from "vitest";
import { assertNoCrossVariantStateLeak } from "../qa/assertNoCrossVariantStateLeak.js";
import { assertNoStaleControllerReuse } from "../qa/assertNoStaleControllerReuse.js";

describe("cross-variant state reset regression", () => {
  it("flags Badugi running with a stale D01 controller", () => {
    const result = assertNoCrossVariantStateLeak({
      currentVariant: "badugi",
      controllerClass: "D1TripleDrawController",
      controllerVariantRef: "deuce_to_seven_triple_draw",
      gameControllerVariantId: "deuce_to_seven_triple_draw",
      controllerSnapshotVariantId: "deuce_to_seven_triple_draw",
      handId: "D01-h12",
    });

    expect(result.status).toBe("FAIL");
    expect(result.violations.map((violation) => violation.type)).toEqual(
      expect.arrayContaining([
        "CROSS_VARIANT_CONTROLLER",
        "CROSS_VARIANT_SNAPSHOT",
        "CROSS_VARIANT_CONTROLLER_CLASS",
      ]),
    );
  });

  it("allows a fresh Badugi controller after switching from D01", () => {
    const result = assertNoCrossVariantStateLeak({
      previousVariant: "deuce_to_seven_triple_draw",
      currentVariant: "badugi",
      controllerClass: "BadugiGameController",
      controllerVariantRef: "badugi",
      gameControllerVariantId: "badugi",
      controllerSnapshotVariantId: "badugi",
      previousHandId: "D01-h12",
      handId: "badugi-h1",
    });

    expect(result.status).toBe("PASS");
    expect(result.violations).toHaveLength(0);
  });

  it("reports stale keys when a hard mismatch also crosses a variant boundary", () => {
    const result = assertNoStaleControllerReuse({
      previousVariant: "D01",
      nextVariant: "badugi",
      currentVariant: "badugi",
      controllerClass: "D1TripleDrawController",
      controllerVariantRef: "D01",
      previous: {
        phase: "BET",
        drawRound: 1,
        currentBet: 20,
        actingPlayerIndex: 3,
      },
      next: {
        phase: "BET",
        drawRound: 1,
        currentBet: 20,
        actingPlayerIndex: 3,
      },
    });

    expect(result.status).toBe("FAIL");
    expect(result.staleKeys).toEqual(
      expect.arrayContaining(["phase", "drawRound", "currentBet", "actingPlayerIndex"]),
    );
  });
});

