import { describe, expect, it } from "vitest";

import { buildCoachingViewModelSummary } from "../buildCoachingViewModel.js";

describe("buildCoachingViewModel", () => {
  it("combines Step47 handoff, feedback, and replay link data", () => {
    const report = buildCoachingViewModelSummary({
      handoff: {
        candidates: [
          {
            candidateId: "S02_DEEP_RAISECHECK_PC4",
            variantId: "S02",
            spot: "deep RAISE-vs-CHECK",
            bucket: "bucket",
            severity: "medium",
            lessonTag: "missed-value",
            estimatedEVGain: 36.8,
            recommendedAction: "RAISE",
            baselineAction: "CHECK",
            playerCount: 4,
            exactHits: 12,
            exactOpportunities: 12,
          },
        ],
      },
      tournamentPayload: { worstLeakSpot: { playerCount: 4 } },
      feedbackDraft: { drafts: [{ candidateId: "S02_DEEP_RAISECHECK_PC4", jp: "jp", en: "en", tone: "coach-light" }] },
      replayLinks: { links: [{ candidateId: "S02_DEEP_RAISECHECK_PC4", replayRef: "r", viewerRoutePreview: "/replay", replayDeterministic: true }] },
    });
    expect(report.lessonCount).toBe(1);
    expect(report.lessons[0].primaryTournamentLeak).toBe(true);
    expect(report.lessons[0].replayDeterministic).toBe(true);
  });
});
