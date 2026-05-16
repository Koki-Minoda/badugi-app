import { describe, expect, it } from "vitest";
import { buildTournamentFeedbackPayloadSummary } from "../../ai/iron/buildTournamentFeedbackPayload.js";
import { assertTournamentFeedbackInvariant } from "../../engine/invariant/assertTournamentFeedbackInvariant.js";

describe("tournament feedback and coaching payload", () => {
  it("builds safe bilingual feedback with valid variant and EV fields", () => {
    const payload = buildTournamentFeedbackPayloadSummary({
      candidates: [{
        variantId: "D01",
        spot: "turn-check",
        bucket: "deep-stack",
        playerCount: 6,
        lessonTag: "pressure",
        estimatedEVGain: 1.25,
        ironAction: "bet",
        proAction: "check",
      }],
    });
    expect(payload.worstLeakSpot.variantId).toBe("D01");
    expect(Number.isFinite(payload.worstLeakSpot.estimatedEVLoss)).toBe(true);
    expect(payload.summary.jp.length).toBeGreaterThan(0);
    expect(payload.summary.en.length).toBeGreaterThan(0);
    expect(`${payload.summary.en} ${payload.summary.jp}`).not.toMatch(/guaranteed|GTO certainty/i);
  });

  it("treats missing feedback candidate as safe empty state", () => {
    const payload = buildTournamentFeedbackPayloadSummary({ candidates: [] });
    expect(payload.worstLeakSpot).toBeNull();
    expect(payload.summary.en).toMatch(/No tournament-end feedback/i);
    expect(assertTournamentFeedbackInvariant({ feedbackExpected: false, feedbackSafe: true })).toEqual([]);
  });
});
