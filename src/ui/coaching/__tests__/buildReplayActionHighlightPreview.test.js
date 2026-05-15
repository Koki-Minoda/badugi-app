import { describe, expect, it } from "vitest";
import { buildReplayActionHighlightPreviewSummary } from "../buildReplayActionHighlightPreview.js";

describe("buildReplayActionHighlightPreviewSummary", () => {
  it("marks integer action indexes as highlightable", () => {
    const report = buildReplayActionHighlightPreviewSummary({
      annotations: {
        annotations: [{ lessonId: "L1", actionIndex: 5, highlightAction: "RAISE" }],
      },
    });
    expect(report.result).toBe("PASS");
    expect(report.highlights[0]).toMatchObject({ highlight: true, actionIndex: 5 });
  });
});

