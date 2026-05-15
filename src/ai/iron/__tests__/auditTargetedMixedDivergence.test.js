import { describe, expect, it } from "vitest";

import { summarizeTargetedMixedDivergence } from "../auditTargetedMixedDivergence.js";

describe("Step44 targeted vs mixed divergence audit", () => {
  it("classifies target-only exposure divergence", () => {
    const report = summarizeTargetedMixedDivergence({
      targetedArena: {
        targetedSampling: true,
        targetBucket: "S02_DEEP_RAISE_CHECK",
        results: [
          {
            variant: "S02",
            bucketHitDistribution: { "S02 deep RAISE-vs-CHECK playerCount=3": 2 },
            candidateBucketObservations: { "S02 deep RAISE-vs-CHECK playerCount=3": 2 },
          },
        ],
      },
      mixedArena: { targetedSampling: false, targetBucket: null, results: [{ variant: "S02" }] },
      repeatability: { metrics: { exactHits: { mean: 2 } } },
    });

    expect(report.divergenceSource).toBe("targeted-table-size-exposure-absent-in-mixed");
  });
});
