import { describe, expect, test } from "vitest";
import { runOneHandProgression } from "./runOneHandProgression.js";

const FAMILY_REPRESENTATIVES = [
  ["DRAW", "D03"],
  ["DRAW", "D01"],
  ["DRAW", "D02"],
  ["DRAW", "S01"],
  ["DRAW", "S02"],
  ["STUD", "ST1"],
  ["STUD", "ST3"],
  ["FLOP_HOLDEM", "B01"],
  ["FLOP_HOLDEM", "B02"],
  ["FLOP_OMAHA", "B05"],
  ["FLOP_OMAHA", "B06"],
  ["SPLIT_POT", "D04"],
  ["SPLIT_POT", "B06"],
  ["SPECIAL", "H01"],
  ["SPECIAL", "H02"],
  ["CHINESE", "CP1"],
];

describe("family one-hand progression guarantee", () => {
  test.each(FAMILY_REPRESENTATIVES)(
    "%s representative %s completes one hand",
    async (family, variantId) => {
      const result = await runOneHandProgression({
        variantId,
        family,
        seed: `family-${family}-${variantId}`,
        maxSteps: 320,
      });

      expect(
        result.status,
        JSON.stringify({ reason: result.reason, lastTrace: result.trace.at(-1) ?? result }, null, 2),
      ).toBe("PASS");
      expect(result.handEnded).toBe(true);
      expect(result.steps).toBeLessThanOrEqual(320);
    },
    15000,
  );
});
