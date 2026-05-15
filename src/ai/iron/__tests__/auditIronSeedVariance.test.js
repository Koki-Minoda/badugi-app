import { describe, expect, it } from "vitest";

import { auditIronSeedVariance } from "../auditIronSeedVariance.js";

describe("auditIronSeedVariance", () => {
  it("summarizes per-seed hit rate and iron-pro gap", () => {
    const report = auditIronSeedVariance({
      arena: {
        results: [
          {
            variant: "S02",
            perSeed: [
              { datasetHitRate: 0, ironProGap: 1, targetBucketProfile: { exactOpportunities: 0 } },
              { datasetHitRate: 0.01, ironProGap: 2, targetBucketProfile: { exactOpportunities: 1 } },
            ],
          },
        ],
      },
    });

    expect(report.variants[0].variant).toBe("S02");
    expect(report.variants[0].datasetHitRate.mean).toBe(0.005);
    expect(report.variants[0].ironProGap.mean).toBe(1.5);
  });
});
