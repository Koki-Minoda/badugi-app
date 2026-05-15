import { describe, expect, it } from "vitest";

import { aggregateCoachingTelemetryByLessonSummary } from "../aggregateCoachingTelemetryByLesson.js";

describe("aggregateCoachingTelemetryByLessonSummary", () => {
  it("aggregates preview events per lesson", () => {
    const report = aggregateCoachingTelemetryByLessonSummary({
      events: [
        { lessonId: "a", type: "LESSON_SHOWN" },
        { lessonId: "a", type: "REPLAY_OPENED" },
        { lessonId: "a", type: "REPLAY_COMPLETED" },
        { lessonId: "a", type: "LESSON_HELPFUL" },
      ],
    });
    expect(report.lessonCount).toBe(1);
    expect(report.lessonsById.a.replayCompletionRate).toBe(1);
    expect(report.lessonsById.a.helpfulRate).toBe(1);
    expect(report.backendUpload).toBe(false);
  });
});
