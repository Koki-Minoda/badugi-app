import { describe, expect, it } from "vitest";

import { interpretDatasetHitDrift } from "../interpretDatasetHitDrift.js";

describe("interpretDatasetHitDrift", () => {
  it("classifies opportunity scarcity when telemetry drops without gameplay drift", () => {
    const report = interpretDatasetHitDrift({
      baselineHitRate: 0.0031,
      currentHitRate: 0,
      sameActionRate: 1,
      exactOpportunities: 0,
      deterministicReplay: true,
      invalidReplayCount: 0,
    });

    expect(report.classification).toBe("OPPORTUNITY_SCARCITY");
  });

  it("classifies matcher regression when explicit signal is present", () => {
    const report = interpretDatasetHitDrift({
      sameActionRate: 0.8,
      exactOpportunities: 3,
      deterministicReplay: true,
      invalidReplayCount: 0,
      matcherRegressionSignals: true,
    });

    expect(report.classification).toBe("MATCHER_REGRESSION");
  });
});
