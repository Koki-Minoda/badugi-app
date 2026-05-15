import { describe, expect, it } from "vitest";

import { auditLearningChartRenderStateSummary } from "../auditLearningChartRenderState.js";

function points(count) {
  return Array.from({ length: count }, (_, index) => ({ x: index + 1, y: index + 2 }));
}

describe("auditLearningChartRenderStateSummary", () => {
  it("passes when global and variant chart points are present", () => {
    const report = auditLearningChartRenderStateSummary({
      fixture: {
        chartSeries: {
          global: { evReviewedCumulative: points(4) },
          byVariant: {
            S02: { evReviewedCumulative: points(2) },
            D02: { evReviewedCumulative: points(2) },
          },
        },
      },
    });
    expect(report.status).toBe("PASS");
    expect(report.svgPathPresent).toBe(true);
    expect(report.pointMarkersPresent).toBe(true);
  });

  it("fails if a variant has no plotted points", () => {
    const report = auditLearningChartRenderStateSummary({
      fixture: {
        chartSeries: {
          global: { evReviewedCumulative: points(4) },
          byVariant: {
            S02: { evReviewedCumulative: points(2) },
            D02: { evReviewedCumulative: [] },
          },
        },
      },
    });
    expect(report.status).toBe("FAIL");
    expect(report.failures).toContain("D02-point-count");
  });
});
