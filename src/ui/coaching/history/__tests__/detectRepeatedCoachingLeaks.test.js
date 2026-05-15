import { describe, expect, it } from "vitest";

import { detectRepeatedCoachingLeaksSummary } from "../detectRepeatedCoachingLeaks.js";

describe("detectRepeatedCoachingLeaksSummary", () => {
  it("detects repeated lesson tag and action family", () => {
    const report = detectRepeatedCoachingLeaksSummary({
      entries: [
        { lessonId: "a", lessonTag: "missed-value", variantId: "S02", actionFamily: "CHECK->RAISE", evDelta: 10 },
        { lessonId: "b", lessonTag: "missed-value", variantId: "S02", actionFamily: "CHECK->RAISE", evDelta: 20 },
      ],
    });
    expect(report.repeatedLeakCount).toBe(1);
    expect(report.repeatedLeaks[0].estimatedEVReviewed).toBe(30);
  });
});
