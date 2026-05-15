import { describe, expect, it } from "vitest";

import { auditOpportunityFrequency } from "../auditOpportunityFrequency.js";

describe("auditOpportunityFrequency", () => {
  it("flags opportunity scarcity without matcher regression", () => {
    const report = auditOpportunityFrequency({
      baselineArena: {
        results: [{ variant: "S02", datasetHitRate: 0.0031, targetBucketProfile: { exactOpportunities: 0 } }],
      },
      currentArena: {
        results: [
          {
            variant: "S02",
            datasetHitRate: 0,
            illegal: 0,
            freeze: 0,
            fallbackReasonDistribution: { NO_MATCHING_STATE: 10 },
            candidateBucketObservations: {},
          },
        ],
      },
    });

    expect(report.variants[0].matcherRegression).toBe(false);
    expect(report.variants[0].opportunityScarcity).toBe(true);
  });
});
