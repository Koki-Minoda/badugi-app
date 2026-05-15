import { describe, expect, it } from "vitest";

import { buildTournamentFeedbackPayloadSummary } from "../buildTournamentFeedbackPayload.js";

describe("buildTournamentFeedbackPayload", () => {
  it("selects the highest EV candidate as the tournament leak preview", () => {
    const report = buildTournamentFeedbackPayloadSummary({
      candidates: [
        { variantId: "S02", spot: "deep", bucket: "pc3", playerCount: 3, estimatedEVGain: 32.2, lessonTag: "missed-value", ironAction: "RAISE", proAction: "CHECK" },
        { variantId: "S02", spot: "deep", bucket: "pc4", playerCount: 4, estimatedEVGain: 36.8, lessonTag: "missed-value", ironAction: "RAISE", proAction: "CHECK" },
      ],
    });
    expect(report.worstLeakSpot.playerCount).toBe(4);
    expect(report.previewOnly).toBe(true);
    expect(report.promoted).toBe(false);
  });
});
