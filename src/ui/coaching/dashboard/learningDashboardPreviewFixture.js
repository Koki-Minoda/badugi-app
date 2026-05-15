export const learningDashboardPreviewFixture = {
  previewOnly: true,
  dashboard: {
    previewOnly: true,
    global: {
      sessions: [
        { sessionId: "step54-preview-session-a", sessionIndex: 1, actualDeltaPreview: 0, evDeltaReviewed: 36.8, lessonCount: 1, replayViewedCount: 1, helpfulCount: 1 },
        { sessionId: "step54-preview-session-b", sessionIndex: 2, actualDeltaPreview: 0, evDeltaReviewed: 32.2, lessonCount: 1, replayViewedCount: 1, helpfulCount: 1 },
        { sessionId: "step55-preview-session-c", sessionIndex: 3, actualDeltaPreview: 0, evDeltaReviewed: 14.5, lessonCount: 1, replayViewedCount: 0, helpfulCount: 1 },
        { sessionId: "step55-preview-session-d", sessionIndex: 4, actualDeltaPreview: 0, evDeltaReviewed: 11.2, lessonCount: 1, replayViewedCount: 0, helpfulCount: 0 },
        { sessionId: "step57-preview-session-e", sessionIndex: 5, actualDeltaPreview: 12, evDeltaReviewed: 18.5, lessonCount: 1, replayViewedCount: 1, helpfulCount: 1 },
        { sessionId: "step57-preview-session-f", sessionIndex: 6, actualDeltaPreview: -4, evDeltaReviewed: 12, lessonCount: 1, replayViewedCount: 0, helpfulCount: 1 },
        { sessionId: "step57-preview-session-g", sessionIndex: 7, actualDeltaPreview: 9, evDeltaReviewed: 21.5, lessonCount: 1, replayViewedCount: 1, helpfulCount: 1 },
        { sessionId: "step57-preview-session-h", sessionIndex: 8, actualDeltaPreview: 5, evDeltaReviewed: 9.5, lessonCount: 1, replayViewedCount: 0, helpfulCount: 0 },
      ],
      totals: { actualDeltaPreview: 22, evDeltaReviewed: 156.2, lessonCount: 8, replayViewedCount: 4, helpfulCount: 6 },
      repeatedLeaks: [
        { variantId: "S02", leakTag: "missed-value", count: 4 },
        { variantId: "D02", leakTag: "second-pressure", count: 4 },
      ],
    },
    byVariant: {
      D02: {
        variantId: "D02",
        sessions: [
          { sessionId: "step55-preview-session-c", sessionIndex: 1, actualDeltaPreview: 0, evDeltaReviewed: 14.5, lessonCount: 1, replayViewedCount: 0, helpfulCount: 1 },
          { sessionId: "step55-preview-session-d", sessionIndex: 2, actualDeltaPreview: 0, evDeltaReviewed: 11.2, lessonCount: 1, replayViewedCount: 0, helpfulCount: 0 },
          { sessionId: "step57-preview-session-f", sessionIndex: 3, actualDeltaPreview: -4, evDeltaReviewed: 12, lessonCount: 1, replayViewedCount: 0, helpfulCount: 1 },
          { sessionId: "step57-preview-session-h", sessionIndex: 4, actualDeltaPreview: 5, evDeltaReviewed: 9.5, lessonCount: 1, replayViewedCount: 0, helpfulCount: 0 },
        ],
        totals: { actualDeltaPreview: 1, evDeltaReviewed: 47.2, lessonCount: 4, replayViewedCount: 0, helpfulCount: 2 },
        repeatedLeaks: [{ variantId: "D02", leakTag: "second-pressure", count: 4 }],
      },
      S02: {
        variantId: "S02",
        sessions: [
          { sessionId: "step54-preview-session-a", sessionIndex: 1, actualDeltaPreview: 0, evDeltaReviewed: 36.8, lessonCount: 1, replayViewedCount: 1, helpfulCount: 1 },
          { sessionId: "step54-preview-session-b", sessionIndex: 2, actualDeltaPreview: 0, evDeltaReviewed: 32.2, lessonCount: 1, replayViewedCount: 1, helpfulCount: 1 },
          { sessionId: "step57-preview-session-e", sessionIndex: 3, actualDeltaPreview: 12, evDeltaReviewed: 18.5, lessonCount: 1, replayViewedCount: 1, helpfulCount: 1 },
          { sessionId: "step57-preview-session-g", sessionIndex: 4, actualDeltaPreview: 9, evDeltaReviewed: 21.5, lessonCount: 1, replayViewedCount: 1, helpfulCount: 1 },
        ],
        totals: { actualDeltaPreview: 21, evDeltaReviewed: 109, lessonCount: 4, replayViewedCount: 4, helpfulCount: 4 },
        repeatedLeaks: [{ variantId: "S02", leakTag: "missed-value", count: 4 }],
      },
    },
  },
  chartSeries: {
    previewOnly: true,
    global: {
      actualResultCumulative: [
        { sessionId: "step54-preview-session-a", x: 1, y: 0 },
        { sessionId: "step54-preview-session-b", x: 2, y: 0 },
        { sessionId: "step55-preview-session-c", x: 3, y: 0 },
        { sessionId: "step55-preview-session-d", x: 4, y: 0 },
        { sessionId: "step57-preview-session-e", x: 5, y: 12 },
        { sessionId: "step57-preview-session-f", x: 6, y: 8 },
        { sessionId: "step57-preview-session-g", x: 7, y: 17 },
        { sessionId: "step57-preview-session-h", x: 8, y: 22 },
      ],
      evReviewedCumulative: [
        { sessionId: "step54-preview-session-a", x: 1, y: 36.8 },
        { sessionId: "step54-preview-session-b", x: 2, y: 69 },
        { sessionId: "step55-preview-session-c", x: 3, y: 83.5 },
        { sessionId: "step55-preview-session-d", x: 4, y: 94.7 },
        { sessionId: "step57-preview-session-e", x: 5, y: 113.2 },
        { sessionId: "step57-preview-session-f", x: 6, y: 125.2 },
        { sessionId: "step57-preview-session-g", x: 7, y: 146.7 },
        { sessionId: "step57-preview-session-h", x: 8, y: 156.2 },
      ],
    },
    byVariant: {
      D02: {
        actualResultCumulative: [
          { sessionId: "step55-preview-session-c", x: 1, y: 0 },
          { sessionId: "step55-preview-session-d", x: 2, y: 0 },
          { sessionId: "step57-preview-session-f", x: 3, y: -4 },
          { sessionId: "step57-preview-session-h", x: 4, y: 1 },
        ],
        evReviewedCumulative: [
          { sessionId: "step55-preview-session-c", x: 1, y: 14.5 },
          { sessionId: "step55-preview-session-d", x: 2, y: 25.7 },
          { sessionId: "step57-preview-session-f", x: 3, y: 37.7 },
          { sessionId: "step57-preview-session-h", x: 4, y: 47.2 },
        ],
      },
      S02: {
        actualResultCumulative: [
          { sessionId: "step54-preview-session-a", x: 1, y: 0 },
          { sessionId: "step54-preview-session-b", x: 2, y: 0 },
          { sessionId: "step57-preview-session-e", x: 3, y: 12 },
          { sessionId: "step57-preview-session-g", x: 4, y: 21 },
        ],
        evReviewedCumulative: [
          { sessionId: "step54-preview-session-a", x: 1, y: 36.8 },
          { sessionId: "step54-preview-session-b", x: 2, y: 69 },
          { sessionId: "step57-preview-session-e", x: 3, y: 87.5 },
          { sessionId: "step57-preview-session-g", x: 4, y: 109 },
        ],
      },
    },
  },
  replayQueue: {
    previewOnly: true,
    queueCount: 3,
    items: [
      { lessonId: "S02_DEEP_RAISECHECK_PC4", variantId: "S02", lessonTag: "missed-value", href: "/replay/S02/20261099/6?decision=5", deterministic: true, evDelta: 36.8 },
      { lessonId: "S02_DEEP_RAISECHECK_PC3", variantId: "S02", lessonTag: "missed-value", href: "/replay/S02/20260609/1?decision=5", deterministic: true, evDelta: 32.2 },
      { lessonId: "STEP57_D02_PLOT_QA_2", variantId: "D02", lessonTag: "second-pressure", href: "/replay/D02/step57/2?decision=3", deterministic: true, evDelta: 12 },
    ],
  },
};
