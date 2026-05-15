import { describe, expect, it } from "vitest";

import { buildLearningDashboardScreenshotFixtureSummary } from "../buildLearningDashboardScreenshotFixture.js";

const bridge = {
  bySession: {
    a: { sessionId: "a", evDeltaReviewed: 10, lessonCount: 1, replayViewedCount: 1, helpfulCount: 1 },
    b: { sessionId: "b", evDeltaReviewed: 8, lessonCount: 1, replayViewedCount: 0, helpfulCount: 0 },
    c: { sessionId: "c", evDeltaReviewed: 7, lessonCount: 1, replayViewedCount: 0, helpfulCount: 1 },
    d: { sessionId: "d", evDeltaReviewed: 6, lessonCount: 1, replayViewedCount: 0, helpfulCount: 0 },
  },
  byVariant: { D02: {}, S02: {} },
  bySessionVariant: {
    "a|S02": { sessionId: "a", variantId: "S02", evDeltaReviewed: 10, lessonCount: 1, replayViewedCount: 1, helpfulCount: 1 },
    "b|S02": { sessionId: "b", variantId: "S02", evDeltaReviewed: 8, lessonCount: 1, replayViewedCount: 0, helpfulCount: 0 },
    "c|D02": { sessionId: "c", variantId: "D02", evDeltaReviewed: 7, lessonCount: 1, replayViewedCount: 0, helpfulCount: 1 },
    "d|D02": { sessionId: "d", variantId: "D02", evDeltaReviewed: 6, lessonCount: 1, replayViewedCount: 0, helpfulCount: 0 },
  },
};

describe("buildLearningDashboardScreenshotFixtureSummary", () => {
  it("adds UI-only sessions and builds expected point counts", () => {
    const report = buildLearningDashboardScreenshotFixtureSummary({
      bridge,
      history: { entries: [] },
      recap: {},
      telemetry: {},
    });
    expect(report.previewOnly).toBe(true);
    expect(report.usesGameplayMutation).toBe(false);
    expect(report.dashboard.global.sessions).toHaveLength(8);
    expect(report.expectedPointCounts.global).toBe(8);
    expect(report.expectedPointCounts.S02).toBe(4);
    expect(report.expectedPointCounts.D02).toBe(4);
    expect(report.replayQueue.queueCount).toBeGreaterThan(0);
  });
});
