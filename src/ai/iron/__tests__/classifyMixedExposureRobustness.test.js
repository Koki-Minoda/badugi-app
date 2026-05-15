import { describe, expect, it } from "vitest";

import { summarizeMixedExposureRobustness } from "../classifyMixedExposureRobustness.js";

describe("mixed exposure robustness classifier", () => {
  it("classifies robust mixed exposure", () => {
    const report = summarizeMixedExposureRobustness({
      hits: { exactHits: 1, exactOpportunities: 1 },
      regression: { allIronProPositive: true, illegal: 0, freeze: 0 },
      fallback: { fallbackStable: true },
    });

    expect(report.classification).toBe("ROBUST");
  });

  it("classifies zero hit exposure as fragile", () => {
    const report = summarizeMixedExposureRobustness({
      hits: { exactHits: 0, exactOpportunities: 0 },
      regression: { allIronProPositive: true, illegal: 0, freeze: 0 },
      fallback: { fallbackStable: true },
    });

    expect(report.classification).toBe("FRAGILE");
  });
});
