import { describe, expect, test } from "vitest";
import { GAME_VARIANTS } from "../../config/variantCatalog.js";
import { getProgressHarnessStatus, runProgressScenario } from "./runProgressScenario.js";
import { getVariantFamilies } from "./runVariantFamilyScenario.js";

const SCENARIO_BY_CATEGORY = {
  board: "cash-10-hands-smoke",
  stud: "cash-10-hands-smoke",
  dramaha: "cash-10-hands-smoke",
  "triple-draw": "cash-10-hands-smoke",
  "single-draw": "cash-10-hands-smoke",
};

// Chinese Poker evaluates complete 13-card arrangements for every hand. On the
// two-core CI runner it can legitimately exceed the default smoke-test budget
// while still completing deterministically. Keep the same 10-hand assertions
// and allow only this compute-heavy variant additional wall-clock time.
const TIMEOUT_BY_VARIANT = {
  CP1: 60_000,
};

function getSkipReason(variant) {
  const status = getProgressHarnessStatus(variant.id);
  if (!status.supported) return status.reason ?? "progress harness not supported";
  return null;
}

describe("MGX all variant progress smoke add-on", () => {
  test("variant registry is available for progress QA", () => {
    expect(GAME_VARIANTS.length).toBeGreaterThanOrEqual(35);
  });

  test("skipped progress variants report explicit reasons", () => {
    const skipped = GAME_VARIANTS.map((variant) => ({
      variant,
      reason: getSkipReason(variant),
    })).filter((entry) => entry.reason);
    skipped.forEach(({ variant, reason }) => {
      console.warn(`[MGX_PROGRESS_SKIP] variantId=${variant.id} category=${variant.category} reason=${reason}`);
    });
    expect(skipped).toEqual([
      expect.objectContaining({
        variant: expect.objectContaining({ id: "CP2", status: "wip" }),
        reason: expect.stringMatching(/controller|harness|support/i),
      }),
    ]);
  });

  test("family-aware progress coverage is not Badugi-only", () => {
    const summary = GAME_VARIANTS.reduce((acc, variant) => {
      const families = getVariantFamilies(variant);
      const familyLabel = families.length ? families.join("+") : "UNCLASSIFIED";
      const status = getProgressHarnessStatus(variant.id);
      families.forEach((family) => {
        if (!acc[family]) acc[family] = { total: 0, supported: 0, skipped: 0 };
        acc[family].total += 1;
        if (status.supported) acc[family].supported += 1;
        else acc[family].skipped += 1;
      });
      console.info(
        `[MGX_PROGRESS_FAMILY] variantId=${variant.id} family=${familyLabel} supported=${status.supported} reason=${status.reason ?? ""}`,
      );
      return acc;
    }, {});

    expect(summary.STUD?.supported ?? 0).toBeGreaterThanOrEqual(6);
    expect(summary.FLOP_HOLDEM?.supported ?? 0).toBeGreaterThanOrEqual(4);
    expect(summary.FLOP_OMAHA?.supported ?? 0).toBeGreaterThanOrEqual(5);
    expect(summary.DRAW?.supported ?? 0).toBeGreaterThanOrEqual(10);
  });

  for (const variant of GAME_VARIANTS) {
    const scenarioId = SCENARIO_BY_CATEGORY[variant.category] ?? "cash-10-hands-smoke";
    const familyLabel = getVariantFamilies(variant).join("+") || "UNCLASSIFIED";
    const title = `${variant.id} [${familyLabel}] ${variant.name ?? variant.label ?? variant.id} progress smoke`;
    const skipReason = getSkipReason(variant);
    if (skipReason) {
      test.skip(`${title} [skip: ${skipReason}]`, () => {});
      continue;
    }

    test(title, () => {
      const result = runProgressScenario({
        variantId: variant.id,
        scenarioId,
        seed: `all-variants-${variant.id}`,
        maxSteps: 200,
        invariantContext: {
          maxDrawRounds: variant.drawRounds,
          handCardCount: variant.holeCards,
          maxDiscardCount: variant.holeCards,
          enforceHandSize:
            variant.category === "triple-draw" ||
            variant.category === "single-draw" ||
            variant.category === "dramaha",
        },
      });
      expect(result.status).toBe("passed");
    }, TIMEOUT_BY_VARIANT[variant.id] ?? 5_000);
  }
});
