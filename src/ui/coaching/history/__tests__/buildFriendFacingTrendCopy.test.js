import { describe, expect, it } from "vitest";

import { buildFriendFacingTrendCopySummary } from "../buildFriendFacingTrendCopy.js";

describe("buildFriendFacingTrendCopySummary", () => {
  it("creates coach-light JP/EN trend copy without solver certainty", () => {
    const report = buildFriendFacingTrendCopySummary({
      recap: { global: { estimatedEVReviewed: 69 }, byVariant: { S02: { estimatedEVReviewed: 69 } } },
      repeatedLeaks: { byVariant: { S02: [{ leakTag: "missed-value", count: 2, estimatedEVReviewed: 69 }] } },
    });
    expect(report.byVariant.S02.jp).toContain("S02");
    expect(report.byVariant.S02.en).toContain("missed-value");
    expect(`${report.byVariant.S02.jp} ${report.byVariant.S02.en}`).not.toMatch(/GTO|solver/i);
  });
});
