import { describe, expect, it } from "vitest";

import { classifyNaturalMixedRepeatabilitySummary } from "../classifyNaturalMixedRepeatability.js";

describe("classifyNaturalMixedRepeatability", () => {
  it("classifies repeatable natural mixed exposure", () => {
    const report = classifyNaturalMixedRepeatabilitySummary({
      repeatability: {
        runCount: 3,
        runsWithExactHits: 2,
        allRunsIllegalFree: true,
        allRunsFreezeFree: true,
        allRunsIronProPositive: true,
      },
      determinism: { deterministic: true, mismatchCount: 0 },
    });
    expect(report.classification).toBe("REPEATABLE");
  });

  it("classifies safety failures as fragile", () => {
    const report = classifyNaturalMixedRepeatabilitySummary({
      repeatability: {
        runCount: 3,
        runsWithExactHits: 2,
        allRunsIllegalFree: false,
        allRunsFreezeFree: true,
        allRunsIronProPositive: true,
      },
      determinism: { deterministic: true, mismatchCount: 0 },
    });
    expect(report.classification).toBe("FRAGILE");
  });
});
