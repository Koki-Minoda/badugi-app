import { describe, expect, it } from "vitest";

import { rankCoverageExpansionCandidates } from "../rankCoverageExpansionCandidates.js";
import { arenaSummaryFixture, divergenceRowsFixture } from "./coverageAuditFixtures.js";

describe("rankCoverageExpansionCandidates", () => {
  it("ranks expansion candidates while preserving frozen governance state", () => {
    const report = rankCoverageExpansionCandidates({
      arenaSummary: arenaSummaryFixture,
      divergenceRows: divergenceRowsFixture,
      topN: 5,
    });

    expect(report.promoted).toBe(false);
    expect(report.routingChanged).toBe(false);
    expect(report.priorityFrozen).toBe(true);
    expect(report.d01Excluded).toBe(true);
    expect(report.ranking[0]).toEqual(
      expect.objectContaining({
        priority: "P1_EXPAND_NEXT",
        variant: "S02",
        bucketFamily: "lowerMediumSDA5 bet-pressure",
      }),
    );
    expect(report.ranking[0].evidence).toEqual(expect.arrayContaining(["fallback hotspot", "medium EV leak"]));
  });
});
