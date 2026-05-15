import { describe, expect, it } from "vitest";
import { buildReplayTimelineMarkersSummary } from "../buildReplayTimelineMarkers.js";

describe("buildReplayTimelineMarkersSummary", () => {
  it("builds coaching timeline markers", () => {
    const report = buildReplayTimelineMarkersSummary({
      annotations: {
        annotations: [{ lessonId: "L1", actionIndex: 5, severity: "medium", lessonTag: "missed-value" }],
      },
    });
    expect(report.result).toBe("PASS");
    expect(report.markers[0]).toMatchObject({
      actionIndex: 5,
      markerType: "coaching",
      severity: "medium",
    });
  });
});

