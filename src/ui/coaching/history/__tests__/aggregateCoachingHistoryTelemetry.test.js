import { describe, expect, it } from "vitest";

import { aggregateCoachingHistoryTelemetrySummary } from "../aggregateCoachingHistoryTelemetry.js";

describe("aggregateCoachingHistoryTelemetrySummary", () => {
  it("aggregates local history telemetry across sessions", () => {
    const report = aggregateCoachingHistoryTelemetrySummary({
      entries: [
        { lessonId: "a", lessonTag: "missed-value", variantId: "S02", actionFamily: "CHECK->RAISE", sessionId: "s1", acknowledged: true, helpfulState: "helpful", replayViewed: true },
        { lessonId: "b", lessonTag: "missed-value", variantId: "S02", actionFamily: "CHECK->RAISE", sessionId: "s2", acknowledged: false, helpfulState: "not-helpful", replayViewed: false },
      ],
    });
    expect(report.lessonsShown).toBe(2);
    expect(report.sessionCount).toBe(2);
    expect(report.helpfulRate).toBe(0.5);
    expect(report.repeatedLeakCount).toBe(1);
  });
});
