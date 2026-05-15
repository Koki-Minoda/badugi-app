import { describe, expect, it } from "vitest";

import { summarizePracticalExposureGain } from "../evaluatePracticalExposureGain.js";

describe("evaluate practical exposure gain", () => {
  it("compares Step40 and Step41 hit exposure", () => {
    const step40Arena = {
      results: [{ variant: "S02", datasetHitRate: 0.001, ironProGap: 1, proFallbackRate: 0.999 }],
    };
    const step41Arena = {
      results: [
        {
          variant: "S02",
          datasetHitRate: 0.01,
          ironProGap: 2,
          proFallbackRate: 0.99,
          ironActionSourceBreakdown: { "dataset-hit": 10, "pro-fallback": 90 },
        },
      ],
    };
    const report = summarizePracticalExposureGain({
      step40Arena,
      step41Arena,
      step40Forced: { hitCount: 0, exactOpportunityCount: 0 },
      step41Forced: { exactHits: 5, exactOpportunities: 5 },
    });

    expect(report.gains.datasetHitRateDelta).toBe(0.009);
    expect(report.gains.exactOpportunityDelta).toBe(5);
    expect(report.successMinimumMet).toBe(true);
    expect(report.successIdealMet).toBe(true);
  });
});
