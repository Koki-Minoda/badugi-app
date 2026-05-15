import { describe, expect, it } from "vitest";

import { auditVariantAwareRecapUXSummary } from "../auditVariantAwareRecapUX.js";

describe("auditVariantAwareRecapUXSummary", () => {
  it("passes compact variant-aware recap constraints", () => {
    const report = auditVariantAwareRecapUXSummary({
      recap: {
        byVariant: { S02: {} },
        recentLessons: [{ lessonId: "a", variantId: "S02" }],
        replayRevisitLinks: [{ lessonId: "a" }],
        trendCopy: { byVariant: { S02: { jp: "短い説明", en: "Short copy" } } },
        repeatedLeaks: [{ count: 2 }],
      },
      exportPreview: { previewOnly: true, piiIncluded: false },
    });
    expect(report.status).toBe("PASS");
  });
});
