import { describe, expect, it } from "vitest";

import { buildCoachingSummaryViewModelSummary } from "../buildCoachingSummaryViewModel.js";
import { createCoachingTelemetryEvent } from "../telemetry/schema.js";

const baseLesson = {
  variantId: "S02",
  severity: "medium",
  lessonTag: "missed-value",
  spot: "deep RAISE-vs-CHECK",
  baselineAction: "CHECK",
  recommendedAction: "RAISE",
  confidence: 0.95,
  exactHits: 5,
  exactOpportunities: 5,
  replayDeterministic: true,
  jp: "この場面ではレイズで価値を取りに行く方が期待値を改善できる可能性があります。",
  en: "Raising may capture more value.",
};

describe("buildCoachingSummaryViewModelSummary", () => {
  it("builds a compact summary with primary and secondary lessons", () => {
    const lessons = [
      { ...baseLesson, lessonId: "pc3", estimatedEVGain: 32.2, replayUrl: "/replay/pc3" },
      { ...baseLesson, lessonId: "pc4", estimatedEVGain: 36.8, replayUrl: "/replay/pc4", playerCount: 4 },
    ];
    const telemetryEvents = lessons.map((lesson) =>
      createCoachingTelemetryEvent({ type: "LESSON_HELPFUL", lesson, sessionId: "test" }),
    );
    const report = buildCoachingSummaryViewModelSummary({ lessons, telemetryEvents });
    expect(report.previewOnly).toBe(true);
    expect(report.topLessons).toHaveLength(2);
    expect(report.primaryLesson.lessonId).toBe("pc4");
    expect(report.primaryLesson.titleJp).toContain("4人局面");
    expect(report.summary.jp).toContain("学習ポイント");
    expect(report.totalEstimatedEVGain).toBe(69);
  });
});
