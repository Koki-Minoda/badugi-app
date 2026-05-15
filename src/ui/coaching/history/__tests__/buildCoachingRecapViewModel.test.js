import { describe, expect, it } from "vitest";

import { buildCoachingRecapViewModelSummary } from "../buildCoachingRecapViewModel.js";

const entries = [
  {
    lessonId: "pc3",
    lessonTag: "missed-value",
    variantId: "S02",
    actionFamily: "CHECK->RAISE",
    evDelta: 32.2,
    sessionId: "s1",
    timestamp: "2026-05-15T04:00:00.000Z",
    replayViewed: true,
    helpfulState: "helpful",
    acknowledged: true,
    replayRef: "r1",
    replayUrl: "/r1",
    replayDeterministic: true,
  },
  {
    lessonId: "pc4",
    lessonTag: "missed-value",
    variantId: "S02",
    actionFamily: "CHECK->RAISE",
    evDelta: 36.8,
    sessionId: "s2",
    timestamp: "2026-05-15T04:01:00.000Z",
    replayViewed: true,
    helpfulState: "helpful",
    acknowledged: true,
    replayRef: "r2",
    replayUrl: "/r2",
    replayDeterministic: true,
  },
];

describe("buildCoachingRecapViewModelSummary", () => {
  it("builds a multi-session recap with repeated leak context", () => {
    const report = buildCoachingRecapViewModelSummary({ entries });
    expect(report.totalLessons).toBe(2);
    expect(report.uniqueLessonTags).toBe(1);
    expect(report.repeatedLeaks[0].leakTag).toBe("missed-value");
    expect(report.replayRevisitCount).toBe(2);
    expect(report.helpfulRate).toBe(1);
    expect(report.estimatedTotalEVReviewed).toBe(69);
  });
});
