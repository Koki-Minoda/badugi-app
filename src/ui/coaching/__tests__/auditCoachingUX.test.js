import { describe, expect, it } from "vitest";

import { auditCoachingUXSummary } from "../auditCoachingUX.js";

describe("auditCoachingUX", () => {
  it("passes when lessons have visible severity, EV, replay CTA, and no duplicates", () => {
    const report = auditCoachingUXSummary({
      viewModel: { lessons: [{ lessonId: "a", severity: "medium", estimatedEVGain: 36.8 }] },
      replayLinks: { links: [{ href: "/replay?x=1" }] },
      localePreview: { mobileTruncationSafe: true, textOverflow: false },
    });
    expect(report.verdict).toBe("PASS");
    expect(report.checks.find((check) => check.check === "duplicate lessons").result).toBe("PASS");
  });
});
