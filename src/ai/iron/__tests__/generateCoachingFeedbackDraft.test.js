import { describe, expect, it } from "vitest";

import { generateCoachingFeedbackDraftSummary } from "../generateCoachingFeedbackDraft.js";

describe("generateCoachingFeedbackDraft", () => {
  it("generates JP and EN coach-light drafts without solver claims", () => {
    const report = generateCoachingFeedbackDraftSummary({
      candidates: [{ variantId: "S02", spot: "deep RAISE-vs-CHECK", playerCount: 3, lessonTag: "missed-value" }],
    });
    expect(report.draftCount).toBe(1);
    expect(report.drafts[0].jp).toContain("可能性があります");
    expect(report.drafts[0].en).toContain("may");
    expect(report.drafts[0].constraints.gtoAssertion).toBe(false);
  });
});
