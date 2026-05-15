import { describe, expect, it } from "vitest";

import { mineIronFallbackHotspots } from "../mineIronFallbackHotspots.js";
import { arenaSummaryFixture, divergenceRowsFixture } from "./coverageAuditFixtures.js";

describe("mineIronFallbackHotspots", () => {
  it("mines high-frequency fallback buckets with remaining Standard advantage", () => {
    const report = mineIronFallbackHotspots({
      arenaSummary: arenaSummaryFixture,
      divergenceRows: divergenceRowsFixture,
      topN: 5,
    });

    expect(report.promoted).toBe(false);
    expect(report.routingChanged).toBe(false);
    expect(report.hotspots).toContainEqual(
      expect.objectContaining({
        variant: "S02",
        bucket: "lowerMediumSDA5 bet-pressure",
        frequency: 90,
        proFallbackRate: 0.996,
        classification: "EXPAND_DATASET",
      }),
    );
    expect(report.hotspots).toContainEqual(
      expect.objectContaining({ bucket: "trashA5 FOLD/CALL verify", classification: "DO_NOT_TOUCH" }),
    );
  });
});
