import { describe, expect, it } from "vitest";

import { summarizeStep39ForcedReplayHits } from "../auditStep39ForcedReplayHits.js";

describe("audit Step39 forced replay hits", () => {
  it("counts exact opportunities and hits for verified forced replay rows", () => {
    const rows = [
      {
        sourceType: "verified-forced-replay",
        bucket: "S02 deep RAISE-vs-CHECK playerCount=3",
        chosenBestAction: { type: "RAISE" },
        legalActions: [{ type: "RAISE" }, { type: "CHECK" }],
      },
    ];
    const arena = {
      results: [
        {
          bucketHitDistribution: { "S02 deep RAISE-vs-CHECK playerCount=3": 2 },
          candidateBucketObservations: { "S02 deep RAISE-vs-CHECK playerCount=3": 2 },
          ironActionSourceBreakdown: { "dataset-hit": 2, "pro-fallback": 3 },
          fallbackReasonByBucket: {},
        },
      ],
    };

    const report = summarizeStep39ForcedReplayHits({ arena, rows });
    expect(report.exactOpportunities).toBe(2);
    expect(report.exactHits).toBe(2);
    expect(report.exactHitRate).toBe(1);
    expect(report.legal).toBe(true);
  });
});
