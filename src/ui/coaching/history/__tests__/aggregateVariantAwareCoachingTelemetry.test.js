import { describe, expect, it } from "vitest";

import { aggregateVariantAwareCoachingTelemetrySummary } from "../aggregateVariantAwareCoachingTelemetry.js";

describe("aggregateVariantAwareCoachingTelemetrySummary", () => {
  it("aggregates global, variant, and session-variant metrics", () => {
    const report = aggregateVariantAwareCoachingTelemetrySummary({
      entries: [
        { lessonId: "a", variantId: "S02", lessonTag: "missed-value", actionFamily: "CHECK->RAISE", sessionId: "s1", replayViewed: true, acknowledged: true, helpfulState: "helpful" },
        { lessonId: "b", variantId: "S02", lessonTag: "missed-value", actionFamily: "CHECK->RAISE", sessionId: "s2", replayViewed: true, acknowledged: true, helpfulState: "helpful" },
        { lessonId: "c", variantId: "D02", lessonTag: "second-pressure", sessionId: "s3" },
      ],
    });
    expect(report.global.lessonsShown).toBe(3);
    expect(report.byVariant.S02.replayCompletionRate).toBe(1);
    expect(report.byVariantLessonTag["S02|missed-value"].repeatedLeakCount).toBe(1);
  });
});
