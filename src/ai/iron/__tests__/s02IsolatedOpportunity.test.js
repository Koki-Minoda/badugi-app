import { describe, expect, it } from "vitest";

import { analyzeS02IsolatedBucketOpportunityFromArena } from "../analyzeS02IsolatedBucketOpportunity.js";

describe("S02 isolated bucket opportunity analyzer", () => {
  it("summarizes exact and near opportunity reasons from arena output", () => {
    const report = analyzeS02IsolatedBucketOpportunityFromArena({
      results: [
        {
          variant: "S02",
          datasetHitRate: 0.01,
          proFallbackRate: 0.99,
          sourceTypeAttribution: [
            { sourceType: "verified-neighbor-v3-isolated", hits: 2 },
            { sourceType: "verified-relaxed-match", hits: 3 },
          ],
          fallbackReasonByBucket: {
            "strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated": {
              PRESSURE_CHAIN_MISMATCH: 4,
              POSITION_MISMATCH: 1,
              ACTION_ILLEGAL: 2,
            },
          },
        },
      ],
    });

    expect(report.exactHits).toBe(2);
    expect(report.relaxedHits).toBe(3);
    expect(report.exactOpportunities).toBe(4);
    expect(report.nearOpportunities).toBe(5);
    expect(report.opportunityReasons.ACTION_ILLEGAL).toBe(2);
  });
});
