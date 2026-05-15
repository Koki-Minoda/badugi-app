import { describe, expect, it } from "vitest";

import { mineEntropyAwareCandidates } from "../mineEntropyAwareCandidates.js";

describe("mine entropy aware candidates", () => {
  it("keeps clean medium-entropy candidates and rejects weak or high signFlip buckets", () => {
    const report = mineEntropyAwareCandidates({
      candidates: [
        {
          variant: "S02",
          bucket: "strongSDA5 bet-pressure",
          frequency: 60,
          confidence: 0.85,
          standardAdvantage: 12,
          signFlipRate: 0.05,
          repairRate: 0,
          invalidReplayCount: 0,
          entropyScore: 0.4,
        },
        {
          variant: "S02",
          bucket: "weakSDA5 bet-pressure",
          frequency: 100,
          confidence: 0.9,
          standardAdvantage: 20,
          signFlipRate: 0.05,
          entropyScore: 0.3,
        },
        {
          variant: "S01",
          bucket: "lowerMediumSD27 bet-pressure",
          frequency: 70,
          confidence: 0.7,
          standardAdvantage: 18,
          signFlipRate: 0.35,
          entropyScore: 0.3,
        },
      ],
    });

    expect(report.candidates[0].classification).toBe("SAFE_CANDIDATE");
    expect(report.candidates[1].classification).toBe("DO_NOT_TOUCH");
    expect(report.candidates[2].reason).toContain("high-signFlip");
    expect(report.safeCandidateCount).toBe(1);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
