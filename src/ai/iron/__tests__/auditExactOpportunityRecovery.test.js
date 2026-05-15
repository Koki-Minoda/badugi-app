import { describe, expect, it } from "vitest";

import { summarizeExactOpportunityRecovery } from "../auditExactOpportunityRecovery.js";

describe("auditExactOpportunityRecovery", () => {
  it("compares mixed baseline against natural exposure hits", () => {
    const report = summarizeExactOpportunityRecovery({
      step43: { exactOpportunities: 0, exactHits: 0 },
      step42: { metrics: { exactOpportunities: { mean: 124 }, exactHits: { mean: 124 }, exactHitRate: { mean: 1 } } },
      rows: [
        { sourceType: "verified-forced-replay", playerCount: 3, bucket: "S02 deep RAISE-vs-CHECK playerCount=3", legalActions: ["RAISE", "CHECK"], chosenBestAction: "RAISE" },
        { sourceType: "verified-forced-replay", playerCount: 4, bucket: "S02 deep RAISE-vs-CHECK playerCount=4", legalActions: ["RAISE", "CHECK"], chosenBestAction: "RAISE" },
      ],
      step45Arena: {
        results: [
          {
            bucketHitDistribution: {
              "S02 deep RAISE-vs-CHECK playerCount=3": 2,
              "S02 deep RAISE-vs-CHECK playerCount=4": 1,
            },
            candidateBucketObservations: {
              "S02 deep RAISE-vs-CHECK playerCount=3": 2,
              "S02 deep RAISE-vs-CHECK playerCount=4": 1,
            },
          },
        ],
      },
    });
    expect(report.exactOpportunities).toBe(3);
    expect(report.exactHits).toBe(3);
    expect(report.playerCount3Hits).toBe(2);
    expect(report.playerCount4Hits).toBe(1);
    expect(report.recoveredFromMixedBaseline).toBe(true);
  });
});
