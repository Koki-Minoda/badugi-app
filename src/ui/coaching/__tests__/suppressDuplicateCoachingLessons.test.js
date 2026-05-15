import { describe, expect, it } from "vitest";

import { suppressDuplicateCoachingLessonsSummary } from "../suppressDuplicateCoachingLessons.js";

describe("suppressDuplicateCoachingLessonsSummary", () => {
  it("keeps the highest priority representative for duplicate concepts", () => {
    const report = suppressDuplicateCoachingLessonsSummary({
      lessons: [
        {
          lessonId: "high",
          variantId: "S02",
          lessonTag: "missed-value",
          spot: "deep",
          playerCount: 4,
          baselineAction: "CHECK",
          recommendedAction: "RAISE",
          priorityScore: 80,
        },
        {
          lessonId: "low",
          variantId: "S02",
          lessonTag: "missed-value",
          spot: "deep",
          playerCount: 4,
          baselineAction: "CHECK",
          recommendedAction: "RAISE",
          priorityScore: 20,
        },
      ],
    });
    expect(report.originalCount).toBe(2);
    expect(report.finalCount).toBe(1);
    expect(report.suppressedCount).toBe(1);
    expect(report.finalLessons[0].lessonId).toBe("high");
    expect(report.suppressed[0].reason).toBe("same-teaching-concept");
  });
});
