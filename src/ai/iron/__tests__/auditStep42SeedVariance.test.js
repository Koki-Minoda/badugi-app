import { describe, expect, it } from "vitest";

import { summarizeStep42SeedVariance } from "../auditStep42SeedVariance.js";

function arena({ gap = 1, exactHitRate = 1 } = {}) {
  const hits = exactHitRate > 0 ? 2 : 0;
  return {
    results: [
      {
        variant: "S02",
        ironProGap: gap,
        datasetHitRate: 0.01,
        proFallbackRate: 0.99,
        bucketHitDistribution: {
          "S02 deep RAISE-vs-CHECK playerCount=3": hits,
          "S02 deep RAISE-vs-CHECK playerCount=4": hits,
        },
        candidateBucketObservations: {
          "S02 deep RAISE-vs-CHECK playerCount=3": 2,
          "S02 deep RAISE-vs-CHECK playerCount=4": 2,
        },
      },
    ],
  };
}

describe("Step42 seed variance audit", () => {
  it("passes stable positive repeatability", () => {
    const report = summarizeStep42SeedVariance({ arenas: [arena({ gap: 1 }), arena({ gap: 2 })] });
    expect(report.status).toBe("PASS");
    expect(report.variance.ironProGap.mean).toBe(1.5);
  });

  it("fails exact hit-rate collapse", () => {
    const report = summarizeStep42SeedVariance({ arenas: [arena({ exactHitRate: 0 }), arena({ gap: 1 })] });
    expect(report.status).toBe("FAIL");
    expect(report.reason).toContain("exact-hit-rate-collapse");
  });
});
