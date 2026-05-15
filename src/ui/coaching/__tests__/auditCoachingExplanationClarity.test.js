import { describe, expect, it } from "vitest";
import { auditCoachingExplanationClaritySummary } from "../auditCoachingExplanationClarity.js";

describe("auditCoachingExplanationClaritySummary", () => {
  it("passes concise non-dogmatic coaching copy", () => {
    const report = auditCoachingExplanationClaritySummary({
      annotationReport: {
        annotations: [
          {
            lessonId: "S02_DEEP_RAISECHECK_PC4",
            lessonTag: "missed-value",
            recommendedAction: "RAISE",
            baselineAction: "CHECK",
            evDelta: 36.8,
            jp: "この場面ではレイズして価値を取りに行く方が期待値を改善できる可能性があります。",
            en: "Raising may capture more value than checking back in this deep-stack spot.",
          },
        ],
      },
    });

    expect(report.status).toBe("PASS");
  });

  it("rejects solver certainty wording", () => {
    const report = auditCoachingExplanationClaritySummary({
      annotationReport: {
        annotations: [
          {
            lessonId: "x",
            lessonTag: "missed-value",
            recommendedAction: "RAISE",
            baselineAction: "CHECK",
            evDelta: 1,
            jp: "この場面では必ずレイズです。",
            en: "You must raise.",
          },
        ],
      },
    });

    expect(report.status).toBe("FAIL");
  });
});
