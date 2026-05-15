import { describe, expect, it } from "vitest";

import { mineMediumEVLeaks } from "../mineMediumEVLeaks.js";
import { arenaSummaryFixture, divergenceRowsFixture } from "./coverageAuditFixtures.js";

describe("mineMediumEVLeaks", () => {
  it("keeps medium EV leaks and classifies weak/trash broad buckets as do-not-touch", () => {
    const report = mineMediumEVLeaks({
      arenaSummary: arenaSummaryFixture,
      divergenceRows: divergenceRowsFixture,
      minSampleCount: 20,
      topN: 5,
    });

    expect(report.thresholds.meanDeltaRange).toEqual([3, 80]);
    expect(report.candidates).toContainEqual(
      expect.objectContaining({
        variant: "S02",
        bucket: "lowerMediumSDA5 bet-pressure",
        sampleCount: 90,
        meanDelta: 32,
        classification: "EXPAND_DATASET",
      }),
    );
    expect(report.candidates).toContainEqual(
      expect.objectContaining({ bucket: "trashA5 FOLD/CALL verify", classification: "DO_NOT_TOUCH" }),
    );
  });
});
