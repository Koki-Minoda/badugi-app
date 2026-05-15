import { describe, expect, it } from "vitest";

import { hardenDriftThresholds } from "../hardenDriftThresholds.js";

describe("hardenDriftThresholds", () => {
  it("suppresses sparse false warns without gameplay regressions", () => {
    const report = hardenDriftThresholds({
      rawDriftStatus: "WARN",
      sameActionRate: 1,
      ironProGaps: [0, 0, 0],
      rollingDatasetHitRateDrop: 1,
      exactOpportunityRateCollapse: false,
    });

    expect(report.hardenedStatus).toBe("PASS");
    expect(report.suppressedFalseWarn).toBe(true);
  });

  it("keeps warn when rolling drop coincides with gameplay signal", () => {
    const report = hardenDriftThresholds({
      rawDriftStatus: "WARN",
      sameActionRate: 0.9,
      ironProGaps: [1, 1, 1],
      rollingDatasetHitRateDrop: 1,
      exactOpportunityRateCollapse: true,
    });

    expect(report.hardenedStatus).toBe("WARN");
  });
});
