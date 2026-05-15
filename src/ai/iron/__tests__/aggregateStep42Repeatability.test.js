import { describe, expect, it } from "vitest";

import { aggregateStep42RepeatabilitySummary } from "../aggregateStep42Repeatability.js";

function arena({ hits3 = 2, hits4 = 1, gap = 1, hitRate = 0.01 } = {}) {
  return {
    arenaId: "iron-step42",
    results: [
      {
        variant: "S02",
        ironProGap: gap,
        datasetHitRate: hitRate,
        proFallbackRate: 0.99,
        illegal: 0,
        freeze: 0,
        bucketHitDistribution: {
          "S02 deep RAISE-vs-CHECK playerCount=3": hits3,
          "S02 deep RAISE-vs-CHECK playerCount=4": hits4,
        },
        candidateBucketObservations: {
          "S02 deep RAISE-vs-CHECK playerCount=3": hits3,
          "S02 deep RAISE-vs-CHECK playerCount=4": hits4,
        },
      },
    ],
  };
}

describe("aggregate Step42 repeatability", () => {
  it("summarizes exact hit repeatability across arena runs", () => {
    const report = aggregateStep42RepeatabilitySummary({ arenas: [arena(), arena({ hits3: 3, hits4: 2, gap: 2 })] });

    expect(report.runs).toHaveLength(2);
    expect(report.allRunsHaveExactOpportunities).toBe(true);
    expect(report.allRunsHaveExactHits).toBe(true);
    expect(report.allRunsIronProPositive).toBe(true);
    expect(report.metrics.exactHits.mean).toBe(4);
  });
});
