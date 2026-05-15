import { describe, expect, it } from "vitest";

import { scoreCoachingLessonPrioritiesSummary } from "../scoreCoachingLessonPriority.js";

const lessons = [
  {
    lessonId: "B",
    variantId: "S02",
    severity: "medium",
    lessonTag: "missed-value",
    estimatedEVGain: 20,
    confidence: 0.9,
    exactHits: 2,
    exactOpportunities: 2,
    replayDeterministic: true,
  },
  {
    lessonId: "A",
    variantId: "S02",
    severity: "medium",
    lessonTag: "missed-value",
    estimatedEVGain: 20,
    confidence: 0.9,
    exactHits: 2,
    exactOpportunities: 2,
    replayDeterministic: true,
  },
];

describe("scoreCoachingLessonPrioritiesSummary", () => {
  it("scores lessons and uses lessonId as stable tie-breaker", () => {
    const report = scoreCoachingLessonPrioritiesSummary({ lessons });
    expect(report.deterministicSorting).toBe(true);
    expect(report.lessons.map((lesson) => lesson.lessonId)).toEqual(["A", "B"]);
    expect(report.lessons[0].priorityScore).toBeGreaterThan(0);
    expect(report.lessons[0].priorityReasons).toContain("deterministic-replay");
  });

  it("uses helpful preview telemetry without mutating ranking inputs", () => {
    const report = scoreCoachingLessonPrioritiesSummary({
      lessons,
      telemetryByLesson: { B: { helpful: 1, notHelpful: 0, helpfulRate: 1 } },
    });
    expect(report.lessons[0].lessonId).toBe("B");
  });
});
