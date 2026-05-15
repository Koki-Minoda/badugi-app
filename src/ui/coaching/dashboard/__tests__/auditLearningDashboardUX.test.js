import { describe, expect, it } from "vitest";

import { auditLearningDashboardUXSummary } from "../auditLearningDashboardUX.js";

describe("auditLearningDashboardUXSummary", () => {
  it("passes graph preview UX checks", () => {
    const report = auditLearningDashboardUXSummary({
      dashboard: { previewOnly: true, byVariant: { S02: {} } },
      series: { global: { evReviewedCumulative: [{ x: 1, y: 10 }] } },
      queue: { items: [{ lessonId: "a" }] },
    });
    expect(report.status).toBe("PASS");
  });
});
