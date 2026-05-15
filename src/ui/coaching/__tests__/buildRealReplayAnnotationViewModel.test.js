import { describe, expect, it } from "vitest";
import { buildRealReplayAnnotationViewModelSummary } from "../buildRealReplayAnnotationViewModel.js";

describe("buildRealReplayAnnotationViewModelSummary", () => {
  it("builds annotation data from real fixture alignment", () => {
    const report = buildRealReplayAnnotationViewModelSummary({
      fixtureReport: {
        fixtures: [
          {
            lessonId: "S02_DEEP_RAISECHECK_PC3",
            variantId: "S02",
            handId: "h-1",
            actionIndex: 5,
            actorSeat: 2,
            playerCount: 3,
            actionAtIndex: { action: "RAISE" },
            realReplayRef: { seed: 1, handId: 2, step: 5 },
            coaching: {
              recommendedAction: "RAISE",
              baselineAction: "CHECK",
              evDelta: 32.2,
              severity: "medium",
              lessonTag: "missed-value",
              jp: "JP",
              en: "EN",
              replayDeterministic: true,
            },
          },
        ],
      },
      alignmentReport: {
        alignments: [{ lessonId: "S02_DEEP_RAISECHECK_PC3", status: "PASS", actualAction: "RAISE" }],
      },
    });

    expect(report.status).toBe("PASS");
    expect(report.annotations[0]).toMatchObject({
      lessonId: "S02_DEEP_RAISECHECK_PC3",
      actualAction: "RAISE",
      recommendedAction: "RAISE",
      alignmentStatus: "PASS",
      deterministic: true,
    });
  });
});
