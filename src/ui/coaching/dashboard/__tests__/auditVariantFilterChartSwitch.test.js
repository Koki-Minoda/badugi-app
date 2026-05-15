import { describe, expect, it } from "vitest";

import { auditVariantFilterChartSwitchSummary } from "../auditVariantFilterChartSwitch.js";

function points(count, start = 1) {
  return Array.from({ length: count }, (_, index) => ({ x: index + 1, y: start + index }));
}

describe("auditVariantFilterChartSwitchSummary", () => {
  it("passes when filters expose distinct chart data and queue slices", () => {
    const report = auditVariantFilterChartSwitchSummary({
      fixture: {
        chartSeries: {
          global: { evReviewedCumulative: points(8, 10) },
          byVariant: {
            S02: { evReviewedCumulative: points(4, 30) },
            D02: { evReviewedCumulative: points(4, 5) },
          },
        },
        replayQueue: {
          items: [
            { lessonId: "s", variantId: "S02" },
            { lessonId: "d", variantId: "D02" },
          ],
        },
      },
    });
    expect(report.status).toBe("PASS");
    expect(report.filters.all.points).toBe(8);
    expect(report.filters.S02.replayQueueCount).toBe(1);
  });
});
