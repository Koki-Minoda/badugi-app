import { describe, expect, it } from "vitest";
import { auditReplayActionAlignmentSummary } from "../auditReplayActionAlignment.js";

describe("auditReplayActionAlignmentSummary", () => {
  it("passes when the coaching action aligns with the replay action row", () => {
    const report = auditReplayActionAlignmentSummary({
      fixtureReport: {
        fixtures: [
          {
            lessonId: "S02_DEEP_RAISECHECK_PC4",
            variantId: "S02",
            actionIndex: 5,
            actorSeat: 2,
            playerCount: 4,
            actionAtIndex: { action: "RAISE", seat: 2 },
            coaching: {
              recommendedAction: "RAISE",
              baselineAction: "CHECK",
              replayDeterministic: true,
            },
            sourceMetadata: {
              legalActions: ["FOLD", "CHECK", "RAISE"],
              playerCount: 4,
              stackDepth: "deep",
              handClass: "strongSDA5",
            },
          },
        ],
      },
    });

    expect(report.status).toBe("PASS");
    expect(report.alignments[0].failures).toHaveLength(0);
  });

  it("fails when the recommended action is not legal", () => {
    const report = auditReplayActionAlignmentSummary({
      fixtureReport: {
        fixtures: [
          {
            lessonId: "bad",
            variantId: "S02",
            actionIndex: 5,
            actorSeat: 2,
            playerCount: 3,
            actionAtIndex: { action: "RAISE", seat: 2 },
            coaching: {
              recommendedAction: "RAISE",
              baselineAction: "CHECK",
              replayDeterministic: true,
            },
            sourceMetadata: {
              legalActions: ["FOLD", "CHECK"],
              playerCount: 3,
              stackDepth: "deep",
            },
          },
        ],
      },
    });

    expect(report.status).toBe("FAIL");
    expect(report.alignments[0].failures).toContain("recommended-action-not-legal");
  });
});
