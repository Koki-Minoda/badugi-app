import { describe, expect, it } from "vitest";

import { detectVariantRepeatedLeaksSummary } from "../detectVariantRepeatedLeaks.js";

describe("detectVariantRepeatedLeaksSummary", () => {
  it("keeps repeated leak rankings scoped by variant", () => {
    const report = detectVariantRepeatedLeaksSummary({
      entries: [
        { lessonId: "a", variantId: "S02", lessonTag: "missed-value", actionFamily: "CHECK->RAISE", evDelta: 32 },
        { lessonId: "b", variantId: "S02", lessonTag: "missed-value", actionFamily: "CHECK->RAISE", evDelta: 37 },
        { lessonId: "c", variantId: "D02", lessonTag: "missed-value", actionFamily: "CHECK->RAISE", evDelta: 5 },
      ],
    });
    expect(report.byVariant.S02).toHaveLength(1);
    expect(report.byVariant.D02).toHaveLength(0);
    expect(report.byVariant.S02[0].estimatedEVReviewed).toBe(69);
  });
});
