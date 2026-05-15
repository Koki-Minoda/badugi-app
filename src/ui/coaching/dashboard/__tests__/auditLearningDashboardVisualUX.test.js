import { describe, expect, it } from "vitest";

import { auditLearningDashboardVisualUXSummary } from "../auditLearningDashboardVisualUX.js";

describe("auditLearningDashboardVisualUXSummary", () => {
  it("passes visual UX checks with chart, screenshots, tabs, and queue", () => {
    const report = auditLearningDashboardVisualUXSummary({
      fixture: {
        chartSeries: {
          global: {
            evReviewedCumulative: [
              { y: 10 },
              { y: 20 },
              { y: 30 },
              { y: 40 },
            ],
          },
        },
        dashboard: { byVariant: { D02: {}, S02: {} } },
        replayQueue: { queueCount: 2 },
      },
      renderState: { status: "PASS" },
      screenshotEvidence: {
        screenshots: {
          mobilePortrait: { nonEmpty: true },
          mobileLandscape: { nonEmpty: true },
        },
      },
      variantFilter: { status: "PASS" },
    });
    expect(report.status).toBe("PASS");
    expect(report.checks.goldBlackThemeVisible).toBe(true);
  });
});
