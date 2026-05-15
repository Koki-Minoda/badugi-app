import { describe, expect, it } from "vitest";
import { auditStep52CoachingUXSummary } from "../auditStep52CoachingUX.js";

describe("auditStep52CoachingUXSummary", () => {
  it("passes preview-only coaching telemetry UX checks", () => {
    const report = auditStep52CoachingUXSummary({
      engagementReport: {
        events: [{ type: "LESSON_SHOWN", deviceClass: "mobile" }],
        hiddenTelemetry: false,
        externalAnalyticsSdk: false,
      },
    });

    expect(report.status).toBe("PASS");
    expect(report.mobileAudit).toHaveLength(3);
    expect(report.fallbackAudit.every((entry) => entry.safe)).toBe(true);
  });
});
