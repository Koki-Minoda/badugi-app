import { describe, expect, it } from "vitest";

import { analyzeStandardAdvantage } from "../analyzeStandardAdvantage.js";
import { arenaSummaryFixture, divergenceRowsFixture } from "./coverageAuditFixtures.js";

describe("analyzeStandardAdvantage", () => {
  it("attributes Standard advantage by variant and bucket without changing governance flags", () => {
    const report = analyzeStandardAdvantage({
      arenaSummary: arenaSummaryFixture,
      divergenceRows: divergenceRowsFixture,
      topN: 5,
    });

    expect(report.promoted).toBe(false);
    expect(report.routingChanged).toBe(false);
    expect(report.variantSummary).toContainEqual(
      expect.objectContaining({ variant: "S02", datasetHitRate: 0.004, proFallbackRate: 0.996 }),
    );
    expect(report.buckets[0]).toEqual(
      expect.objectContaining({
        variant: "S02",
        bucket: "lowerMediumSDA5 bet-pressure",
        selectedAction: "CALL",
        proAction: "FOLD",
        frequency: 90,
        classification: "EXPAND_DATASET",
      }),
    );
  });
});
