import { describe, expect, it } from "vitest";

import { calibrateGovernanceThresholds } from "../calibrateGovernanceThresholds.js";

function run({ datasetHitRate = 0.001, gap = 1 } = {}) {
  return {
    rawStatus: "WARN",
    hardenedStatus: "PASS",
    datasetHitRate,
    rollingDatasetHitRate: 0.001,
    ironProGap: { D02: gap, S01: gap, S02: gap },
    exactOpportunityRate: 0,
    sameActionRate: 1,
    proFallbackRate: 1,
    deterministicReplay: true,
  };
}

describe("calibrateGovernanceThresholds", () => {
  it("proposes thresholds from completed run distributions", () => {
    const report = calibrateGovernanceThresholds({
      history: [
        run({ datasetHitRate: 0.001, gap: 1 }),
        run({ datasetHitRate: 0.0009, gap: 1.2 }),
        run({ datasetHitRate: 0.0011, gap: 0.9 }),
        run({ datasetHitRate: 0.001, gap: 1.1 }),
        run({ datasetHitRate: 0.001, gap: 1 }),
      ],
    });

    expect(report.sampleStatus).toBe("ENOUGH_SAMPLE");
    expect(report.datasetHitRateDropMaxRecommended).toBeGreaterThanOrEqual(0.5);
    expect(report.ironProGapFailRuns).toBe(3);
    expect(report.consecutiveSparseWarnForReview).toBe(5);
  });

  it("keeps sparse all-zero hit rates as recommendation-only calibration", () => {
    const report = calibrateGovernanceThresholds({
      history: Array.from({ length: 5 }, () => run({ datasetHitRate: 0, gap: 0 })),
    });

    expect(report.datasetHitRateDropMaxRecommended).toBe(0.75);
    expect(report.thresholdChanges).toContain("recommendation-only");
  });
});
