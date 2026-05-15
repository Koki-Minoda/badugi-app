import { describe, expect, it } from "vitest";

import { buildEVResultGraphViewModelSummary } from "../buildEVResultGraphViewModel.js";

describe("buildEVResultGraphViewModelSummary", () => {
  it("builds a graph viewmodel for selected variant", () => {
    const report = buildEVResultGraphViewModelSummary({
      selectedVariant: "S02",
      dashboard: { byVariant: { S02: { sessions: [{ sessionId: "a" }], totals: { evDeltaReviewed: 69 } } } },
      series: { byVariant: { S02: { evReviewedCumulative: [{ x: 1, y: 69 }] } } },
    });
    expect(report.selectedVariant).toBe("S02");
    expect(report.series.evReviewed).toHaveLength(1);
    expect(report.previewNotice).toContain("プレビュー");
  });

  it("returns safe fallback for missing variant", () => {
    const report = buildEVResultGraphViewModelSummary({ selectedVariant: "D02", dashboard: { byVariant: {} } });
    expect(report.empty).toBe(true);
    expect(report.fallback.safe).toBe(true);
  });
});
