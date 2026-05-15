import { describe, expect, it } from "vitest";

import { analyzeIronCoverageGap } from "../analyzeIronCoverageGap.js";
import { arenaSummaryFixture, divergenceRowsFixture } from "./coverageAuditFixtures.js";

describe("analyzeIronCoverageGap", () => {
  it("reports missing bucket, hand class, street, player count, position, and pressure coverage", () => {
    const report = analyzeIronCoverageGap({
      arenaSummary: arenaSummaryFixture,
      divergenceRows: divergenceRowsFixture,
    });

    const s02 = report.variants.find((entry) => entry.variant === "S02");
    expect(s02.datasetHitRate).toBe(0.004);
    expect(s02.proFallbackRate).toBe(0.996);
    expect(s02.bucketCoverage.covered).toContain("strongSDA5 top-end pressure");
    expect(s02.bucketCoverage.missing).toContain("lowerMediumSDA5 bet-pressure");
    expect(s02.handClassCoverage.observed).toContain("lowerMediumSDA5");
    expect(s02.pressureCoverage.observed).toContain("bet-pressure");
  });
});
