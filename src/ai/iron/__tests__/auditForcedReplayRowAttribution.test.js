import { describe, expect, it } from "vitest";

import { summarizeForcedReplayRowAttribution } from "../auditForcedReplayRowAttribution.js";

describe("summarizeForcedReplayRowAttribution", () => {
  it("summarizes verified forced-replay hits and legal rows", () => {
    const report = summarizeForcedReplayRowAttribution({
      preexportRows: [
        {
          sourceType: "verified-forced-replay",
          bucket: "S02 deep RAISE-vs-CHECK playerCount=3",
          chosenBestAction: { type: "RAISE" },
          legalActions: [{ type: "CHECK" }, { type: "RAISE" }],
        },
      ],
      arena: {
        results: [
          {
            bucketHitDistribution: { "S02 deep RAISE-vs-CHECK playerCount=3": 2 },
            candidateBucketObservations: { "S02 deep RAISE-vs-CHECK playerCount=3": 3 },
            ironActionSourceBreakdown: { "dataset-hit": 2, "pro-fallback": 1 },
            fallbackReasonByBucket: { "S02 deep RAISE-vs-CHECK playerCount=3": { "action-mismatch": 1 } },
          },
        ],
      },
    });

    expect(report.hitCount).toBe(2);
    expect(report.exactOpportunityCount).toBe(3);
    expect(report.datasetActionLegalCount).toBe(1);
    expect(report.legal).toBe(true);
  });
});
