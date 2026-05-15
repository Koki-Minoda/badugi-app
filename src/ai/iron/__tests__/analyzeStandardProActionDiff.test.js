import { describe, expect, it } from "vitest";

import { analyzeStandardProActionDiff } from "../analyzeStandardProActionDiff.js";
import { divergenceRowsFixture } from "./coverageAuditFixtures.js";

describe("analyzeStandardProActionDiff", () => {
  it("summarizes tracked Standard-vs-Pro action pairs", () => {
    const report = analyzeStandardProActionDiff({ divergenceRows: divergenceRowsFixture, topN: 5 });

    expect(report.actionDiffs[0]).toEqual(
      expect.objectContaining({
        variant: "S02",
        bucket: "lowerMediumSDA5 bet-pressure",
        standardAction: "CALL",
        proAction: "FOLD",
        freq: 90,
        evDelta: 32,
        interpretation: "Standard continues where Pro folds",
      }),
    );
    expect(report.trackedPairs).toContain("BET/CHECK");
  });
});
