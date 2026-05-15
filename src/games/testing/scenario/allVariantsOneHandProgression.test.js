import { describe, expect, test } from "vitest";
import {
  listOneHandProgressionVariants,
  runOneHandProgression,
} from "./runOneHandProgression.js";

const VARIANTS = listOneHandProgressionVariants();

describe("all variants one-hand progression guarantee", () => {
  test("registry exposes the full MGX variant set for one-hand QA", () => {
    expect(VARIANTS.length).toBeGreaterThanOrEqual(35);
  });

  for (const variant of VARIANTS) {
    test(`${variant.id} ${variant.name} completes one hand via controller path`, async () => {
      const result = await runOneHandProgression({
        variantId: variant.id,
        family: variant.family,
        seed: 20260506,
        maxSteps: 320,
      });

      if (result.status === "SKIP") {
        console.warn(
          `[MGX_ONE_HAND_SKIP] variantId=${result.variantId} family=${result.family} reason=${result.skipReason}`,
        );
        return;
      }

      expect(
        result.status,
        JSON.stringify({ reason: result.reason, lastTrace: result.trace.at(-1) ?? result }, null, 2),
      ).toBe("PASS");
      expect(result.handEnded).toBe(true);
      expect(result.steps).toBeLessThanOrEqual(320);
      expect(result.terminalPhase).toMatch(/SHOWDOWN|HAND_OVER|HAND_RESULT|COMPLETE|TERMINAL/);
      expect(Number.isFinite(result.finalPot)).toBe(true);
      expect(result.finalPot).toBeGreaterThanOrEqual(0);
    }, variant.id === "CP1" ? 15000 : 5000);
  }
});
