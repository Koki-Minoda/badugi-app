import { describe, expect, it } from "vitest";

import {
  searchNextSafeCoverageCandidate,
  updateCoverageRankingForClosure,
} from "../searchNextSafeCoverageCandidate.js";

describe("searchNextSafeCoverageCandidate", () => {
  it("downgrades the closed S02 lowerMedium candidate to monitor-only", () => {
    const report = updateCoverageRankingForClosure({
      rankingReport: {
        ranking: [
          { priority: "P2_COUNTERFACTUAL_FIRST", variant: "S02", bucketFamily: "lowerMediumSDA5 bet-pressure", score: 0.1 },
        ],
      },
    });

    expect(report.ranking[0]).toEqual(
      expect.objectContaining({
        priority: "P3_MONITOR_ONLY",
        variant: "S02",
        bucketFamily: "lowerMediumSDA5 bet-pressure",
      }),
    );
    expect(report.ranking[0].closure.decision).toBe("DO_NOT_EXPORT");
  });

  it("returns none when only unsafe or closed candidates remain", () => {
    const report = searchNextSafeCoverageCandidate({
      ranking: [
        { priority: "P3_MONITOR_ONLY", variant: "S02", bucketFamily: "lowerMediumSDA5 bet-pressure", score: 0 },
        { priority: "DO_NOT_TOUCH", variant: "D02", bucketFamily: "trashA5 FOLD/CALL verify", score: 0 },
        { priority: "P2_COUNTERFACTUAL_FIRST", variant: "S01", bucketFamily: "weakSD27 bet-pressure", score: 0.2 },
      ],
    });

    expect(report.classification).toBe("NONE_FOUND");
    expect(report.nextCandidate).toBeNull();
  });
});
