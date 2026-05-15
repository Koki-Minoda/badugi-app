import { describe, expect, it } from "vitest";

import { buildSessionAnalyticsBridgePreviewSummary } from "../buildSessionAnalyticsBridgePreview.js";

describe("buildSessionAnalyticsBridgePreviewSummary", () => {
  it("creates bridge metadata without implementing cash graph", () => {
    const report = buildSessionAnalyticsBridgePreviewSummary({
      entries: [
        { sessionId: "s1", variantId: "S02", source: "tournament", evDelta: 10, helpfulState: "helpful", replayViewed: true },
      ],
    });
    expect(report.bridgeOnly).toBe(true);
    expect(report.cashGraphImplemented).toBe(false);
    expect(report.sessions[0].evDeltaReviewed).toBe(10);
    expect(report.sessions[0]).toHaveProperty("actualDeltaPreview");
  });
});
