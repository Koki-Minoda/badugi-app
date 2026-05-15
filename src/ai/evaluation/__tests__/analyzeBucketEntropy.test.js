import { describe, expect, it } from "vitest";

import { classifyD01SubBucket } from "../d01SubBucketClassifier.js";
import { analyzeBucketEntropy } from "../analyzeBucketEntropy.js";

function buildSample(overrides = {}) {
  return {
    variantId: "D01",
    sampleTag: "iron-step7",
    handClass: "strong27TD",
    drawRound: 3,
    playerCount: 3,
    position: "cutoff",
    facingAction: "raise",
    actorSeat: 0,
    proAction: { type: "FOLD" },
    standardAction: { type: "CALL" },
    snapshot: {
      currentBet: 40,
      players: [
        {
          seatIndex: 0,
          betThisRound: 0,
          hand: ["8S", "4S", "2S", "3C", "5C"],
        },
      ],
    },
    ...overrides,
  };
}

describe("analyzeBucketEntropy", () => {
  it("computes entropy and stable candidates for D01 sub-buckets", () => {
    const sample = buildSample();
    const subBucket = classifyD01SubBucket(sample);
    const report = analyzeBucketEntropy({
      samples: Array.from({ length: 50 }, () => sample),
      bucketResults: [
        {
          variant: "D01",
          bucket: subBucket.subBucketId,
          sampleCount: 50,
          meanDelta: -80,
          stdDev: 12,
          positiveRate: 0.08,
          negativeRate: 0.92,
          confidence: 0.96,
        },
      ],
    });

    expect(report.rowCount).toBe(1);
    expect(report.rows[0].subBucketId).toBe(subBucket.subBucketId);
    expect(report.rows[0].sampleCount).toBe(50);
    expect(report.rows[0].signFlipRate).toBeLessThanOrEqual(0.1);
    expect(report.stableCandidates).toHaveLength(1);
  });
});

