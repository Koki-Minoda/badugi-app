import { describe, expect, it } from "vitest";

import { applyCoachingOverloadGuardSummary } from "../applyCoachingOverloadGuard.js";

describe("applyCoachingOverloadGuardSummary", () => {
  it("limits visible lessons and keeps one primary", () => {
    const report = applyCoachingOverloadGuardSummary({
      lessons: [1, 2, 3, 4].map((value) => ({
        lessonId: `l${value}`,
        priorityScore: value,
        estimatedEVGain: 10,
      })),
    });
    expect(report.visibleLessons).toHaveLength(3);
    expect(report.hiddenLessons).toHaveLength(1);
    expect(report.visibleLessons.filter((lesson) => lesson.displayRole === "primary")).toHaveLength(1);
    expect(report.rules.every((rule) => rule.result === "PASS")).toBe(true);
  });
});
