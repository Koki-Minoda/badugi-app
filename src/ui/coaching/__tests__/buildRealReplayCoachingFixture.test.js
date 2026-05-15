import { describe, expect, it } from "vitest";
import { buildRealReplayCoachingFixtureSummary } from "../buildRealReplayCoachingFixture.js";

describe("buildRealReplayCoachingFixtureSummary", () => {
  it("builds real replay fixtures from Step47/50 lessons and engine-backed samples", async () => {
    const report = await buildRealReplayCoachingFixtureSummary({
      coachingPackage: {
        candidates: [
          {
            candidateId: "S02_DEEP_RAISECHECK_PC3",
            variantId: "S02",
            playerCount: 3,
            recommendedAction: "RAISE",
            baselineAction: "CHECK",
            replayReference: { actionIndex: 5 },
          },
        ],
      },
      replayMetadata: { links: [] },
      annotations: {
        annotations: [
          {
            lessonId: "S02_DEEP_RAISECHECK_PC3",
            variantId: "S02",
            actionIndex: 5,
            highlightAction: "RAISE",
            baselineAction: "CHECK",
            lessonTag: "missed-value",
            severity: "medium",
            evDelta: 32.2,
            jp: "JP",
            en: "EN",
            replayDeterministic: true,
          },
        ],
      },
    });

    expect(report.fixtureCount).toBe(1);
    expect(report.fixtures[0]).toMatchObject({
      lessonId: "S02_DEEP_RAISECHECK_PC3",
      variantId: "S02",
      actionIndex: 5,
      playerCount: 3,
      checks: { actionRowExists: true, replayDeterministic: true },
    });
    expect(report.fixtures[0].actionAtIndex.action).toBe("RAISE");
    expect(report.syntheticReplayInjection).toBe(false);
  });
});
