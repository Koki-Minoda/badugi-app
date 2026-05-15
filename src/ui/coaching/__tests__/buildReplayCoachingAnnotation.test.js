import { describe, expect, it } from "vitest";
import { buildReplayCoachingAnnotationSummary } from "../buildReplayCoachingAnnotation.js";

describe("buildReplayCoachingAnnotationSummary", () => {
  it("builds replay annotations from lessons and focus states", () => {
    const report = buildReplayCoachingAnnotationSummary({
      viewModel: {
        lessons: [
          {
            lessonId: "S02_DEEP_RAISECHECK_PC4",
            variantId: "S02",
            severity: "medium",
            lessonTag: "missed-value",
            estimatedEVGain: 36.8,
            jp: "JP",
            en: "EN",
            recommendedAction: "RAISE",
            baselineAction: "CHECK",
            replayDeterministic: true,
          },
        ],
      },
      focusPreview: {
        focusStates: [
          {
            lessonId: "S02_DEEP_RAISECHECK_PC4",
            status: "ready",
            focusMode: "coaching-lesson",
            actionIndex: 5,
          },
        ],
      },
      replayLinks: {
        links: [{ lessonId: "S02_DEEP_RAISECHECK_PC4", deterministic: true }],
      },
    });
    expect(report.annotationCount).toBe(1);
    expect(report.annotations[0]).toMatchObject({
      actionIndex: 5,
      lessonTag: "missed-value",
      evDelta: 36.8,
      highlightAction: "RAISE",
      focusMode: "coaching-lesson",
    });
  });
});

