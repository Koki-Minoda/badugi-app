import { describe, expect, it } from "vitest";

import { summarizeMixedExposureHits } from "../auditMixedExposureHits.js";

const rows = [
  {
    sourceType: "verified-forced-replay",
    bucket: "S02 deep RAISE-vs-CHECK playerCount=3",
    playerCount: 3,
    chosenBestAction: { type: "RAISE" },
    legalActions: [{ type: "CHECK" }, { type: "RAISE" }],
  },
  {
    sourceType: "verified-forced-replay",
    bucket: "S02 deep RAISE-vs-CHECK playerCount=4",
    playerCount: 4,
    chosenBestAction: { type: "RAISE" },
    legalActions: [{ type: "CHECK" }, { type: "RAISE" }],
  },
];

describe("mixed exposure hit audit", () => {
  it("summarizes verified forced replay hits by player count", () => {
    const report = summarizeMixedExposureHits({
      rows,
      arena: {
        results: [
          {
            candidateBucketObservations: {
              "S02 deep RAISE-vs-CHECK playerCount=3": 2,
              "S02 deep RAISE-vs-CHECK playerCount=4": 1,
            },
            bucketHitDistribution: {
              "S02 deep RAISE-vs-CHECK playerCount=3": 2,
              "S02 deep RAISE-vs-CHECK playerCount=4": 1,
            },
          },
        ],
      },
    });

    expect(report.exactOpportunities).toBe(3);
    expect(report.exactHits).toBe(3);
    expect(report.exactHitRate).toBe(1);
    expect(report.mixedExposureMaintained).toBe(true);
    expect(report.byPlayerCount).toHaveLength(2);
  });
});
