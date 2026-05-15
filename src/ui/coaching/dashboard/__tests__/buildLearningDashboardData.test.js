import { describe, expect, it } from "vitest";

import { buildLearningDashboardDataSummary } from "../buildLearningDashboardData.js";

const bridge = {
  bySession: {
    a: { sessionId: "a", variantId: "mixed", actualDeltaPreview: 0, evDeltaReviewed: 10, lessonCount: 1, replayViewedCount: 1, helpfulCount: 1 },
    b: { sessionId: "b", variantId: "mixed", actualDeltaPreview: 0, evDeltaReviewed: 20, lessonCount: 2, replayViewedCount: 1, helpfulCount: 1 },
  },
  byVariant: {
    S02: { evDeltaReviewed: 30, lessonCount: 3 },
  },
  bySessionVariant: {
    "a|S02": { sessionId: "a", variantId: "S02", evDeltaReviewed: 10, lessonCount: 1, replayViewedCount: 1, helpfulCount: 1 },
    "b|S02": { sessionId: "b", variantId: "S02", evDeltaReviewed: 20, lessonCount: 2, replayViewedCount: 1, helpfulCount: 1 },
  },
};

describe("buildLearningDashboardDataSummary", () => {
  it("builds global and per-variant dashboard data", () => {
    const report = buildLearningDashboardDataSummary({ bridge, history: { totalLessons: 3 }, recap: {}, telemetry: {} });
    expect(report.global.totals.evDeltaReviewed).toBe(30);
    expect(report.global.totals.lessonCount).toBe(3);
    expect(report.byVariant.S02.sessions).toHaveLength(2);
    expect(report.previewOnly).toBe(true);
  });
});
