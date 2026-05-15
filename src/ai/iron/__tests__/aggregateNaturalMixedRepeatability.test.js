import { describe, expect, it } from "vitest";

import { aggregateNaturalMixedRepeatabilitySummary } from "../aggregateNaturalMixedRepeatability.js";

function arena({ hit3 = 1, hit4 = 2, gap = 1 } = {}) {
  return {
    results: [
      { variant: "D02", ironProGap: gap, illegal: 0, freeze: 0 },
      { variant: "S01", ironProGap: gap, illegal: 0, freeze: 0 },
      {
        variant: "S02",
        ironProGap: gap,
        ironStandardGap: -1,
        illegal: 0,
        freeze: 0,
        datasetHitRate: 0.01,
        proFallbackRate: 0.99,
        bucketHitDistribution: {
          "S02 deep RAISE-vs-CHECK playerCount=3": hit3,
          "S02 deep RAISE-vs-CHECK playerCount=4": hit4,
        },
        candidateBucketObservations: {
          "S02 deep RAISE-vs-CHECK playerCount=3": hit3,
          "S02 deep RAISE-vs-CHECK playerCount=4": hit4,
        },
      },
    ],
  };
}

describe("aggregateNaturalMixedRepeatability", () => {
  it("summarizes exact hits and Iron-Pro stability across runs", () => {
    const report = aggregateNaturalMixedRepeatabilitySummary({ arenas: [arena(), arena({ hit3: 0, hit4: 1 })] });
    expect(report.runsWithExactHits).toBe(2);
    expect(report.allRunsIronProPositive).toBe(true);
    expect(report.runs[0].exactHits).toBe(3);
  });
});
