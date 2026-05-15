import { describe, expect, it } from "vitest";

import { simulateDashboardPlotGrowthSummary } from "../simulateDashboardPlotGrowth.js";

describe("simulateDashboardPlotGrowthSummary", () => {
  it("confirms points and cumulative values grow as sessions increase", () => {
    const report = simulateDashboardPlotGrowthSummary();
    expect(report.status).toBe("PASS");
    expect(report.scenarios.map((scenario) => scenario.sessions)).toEqual([4, 8, 12]);
    expect(report.pointsGrow).toBe(true);
    expect(report.evReviewedCumulativeGrows).toBe(true);
    expect(report.lessonCountCumulativeGrows).toBe(true);
    expect(report.handsPlayedGrows).toBe(true);
  });
});
