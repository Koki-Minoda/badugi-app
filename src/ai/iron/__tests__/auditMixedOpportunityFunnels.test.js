import { describe, expect, it } from "vitest";

import { summarizeMixedOpportunityFunnels } from "../auditMixedOpportunityFunnels.js";

describe("Step44 mixed opportunity funnel audit", () => {
  it("identifies disappearance before target exact opportunity", () => {
    const report = summarizeMixedOpportunityFunnels({
      arena: {
        results: [
          {
            variant: "S02",
            datasetHitRate: 0.01,
            proFallbackRate: 0.99,
            ironActionSourceBreakdown: { "dataset-hit": 2, "pro-fallback": 98 },
            candidateBucketObservations: { "strongSDA5 CALL/FOLD/RAISE::pc=4way+": 2 },
            bucketHitDistribution: { "strongSDA5 CALL/FOLD/RAISE": 2 },
          },
        ],
      },
    });

    expect(report.exactOpportunities).toBe(0);
    expect(report.exactHits).toBe(0);
    expect(report.disappearanceStage).toBe("S02 deep RAISE-vs-CHECK family observed");
  });
});
