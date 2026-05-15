import { describe, expect, it } from "vitest";

import { buildLearningChartSeriesSummary } from "../buildLearningChartSeries.js";

describe("buildLearningChartSeriesSummary", () => {
  it("creates cumulative series in deterministic order", () => {
    const report = buildLearningChartSeriesSummary({
      dashboard: {
        global: {
          sessions: [
            { sessionId: "a", sessionIndex: 1, evDeltaReviewed: 10, lessonCount: 1, replayViewedCount: 1, actualDeltaPreview: 0, helpfulCount: 1 },
            { sessionId: "b", sessionIndex: 2, evDeltaReviewed: 5, lessonCount: 2, replayViewedCount: 0, actualDeltaPreview: 0, helpfulCount: 1 },
          ],
        },
        byVariant: {},
      },
    });
    expect(report.global.evReviewedCumulative.map((point) => point.y)).toEqual([10, 15]);
    expect(report.global.lessonCountCumulative.at(-1).y).toBe(3);
  });
});
