import { describe, expect, it } from "vitest";

import { auditCoachingRecapUXSummary } from "../auditCoachingRecapUX.js";

describe("auditCoachingRecapUXSummary", () => {
  it("passes compact recap layouts", () => {
    const report = auditCoachingRecapUXSummary({
      recap: {
        estimatedTotalEVReviewed: 69,
        recentLessons: [{ titleJp: "4人局面の価値を取り逃した場面" }],
        revisitLinks: [{ href: "/r" }],
        repeatedLeaks: [{ leakTag: "missed-value" }],
      },
    });
    expect(report.status).toBe("PASS");
    expect(report.fallbackAudit.every((entry) => entry.safe && entry.crash === false)).toBe(true);
  });
});
