import { describe, expect, it } from "vitest";

import { buildVariantSessionAnalyticsBridgeSummary } from "../buildVariantSessionAnalyticsBridge.js";

describe("buildVariantSessionAnalyticsBridgeSummary", () => {
  it("builds global, variant, session, and session-variant bridge metadata", () => {
    const report = buildVariantSessionAnalyticsBridgeSummary({
      entries: [
        { lessonId: "a", variantId: "S02", sessionId: "s1", evDelta: 10, helpfulState: "helpful", replayViewed: true },
        { lessonId: "b", variantId: "D02", sessionId: "s1", evDelta: 5 },
      ],
    });
    expect(report.bridgeOnly).toBe(true);
    expect(report.byVariant.S02.lessonCount).toBe(1);
    expect(report.bySessionVariant["s1|D02"].evDeltaReviewed).toBe(5);
  });
});
