import { describe, expect, it } from "vitest";
import { buildCoachingEngagementPreviewSummary } from "../buildCoachingEngagementPreview.js";

describe("buildCoachingEngagementPreviewSummary", () => {
  it("builds preview-only engagement telemetry without network upload", () => {
    const report = buildCoachingEngagementPreviewSummary({
      annotationReport: {
        annotations: [
          {
            lessonId: "S02_DEEP_RAISECHECK_PC3",
            variantId: "S02",
            actionIndex: 5,
            evDelta: 32.2,
            severity: "medium",
            deterministic: true,
          },
        ],
      },
    });

    expect(report.previewOnly).toBe(true);
    expect(report.backendUpload).toBe(false);
    expect(report.networkDependency).toBe(false);
    expect(report.eventCounts.LESSON_SHOWN).toBe(1);
    expect(report.metrics.replayCompletionRate).toBe(1);
    expect(report.deterministicOrdering).toBe(true);
  });
});
