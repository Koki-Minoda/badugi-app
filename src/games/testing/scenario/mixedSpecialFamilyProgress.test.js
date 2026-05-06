import { describe, expect, test } from "vitest";
import { runVariantFamilyScenario, summarizeFamilyCoverage, VARIANT_FAMILIES } from "./runVariantFamilyScenario.js";

describe("MGX mixed/special family progress coverage", () => {
  test("MIXED-001 mixed rotation has no direct registry variant and is explicitly tracked as skipped", () => {
    const summary = summarizeFamilyCoverage(VARIANT_FAMILIES.MIXED);
    expect(summary.variantsFound).toBe(0);
  });

  test("SPECIAL-001 Dramaha and special flop variants are family-aware and do not freeze where harnessed", () => {
    const result = runVariantFamilyScenario({
      family: VARIANT_FAMILIES.SPECIAL,
      scenario: "draw-count-full-cycle",
      seed: "special-family",
      maxSteps: 260,
    });
    expect(result.failed).toEqual([]);
    expect(result.tested.length).toBeGreaterThanOrEqual(6);
  });
});
