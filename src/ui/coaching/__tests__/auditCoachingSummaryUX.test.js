import { describe, expect, it } from "vitest";

import { auditCoachingSummaryUXSummary } from "../auditCoachingSummaryUX.js";

describe("auditCoachingSummaryUXSummary", () => {
  it("passes compact readable summaries", () => {
    const report = auditCoachingSummaryUXSummary({
      summary: {
        summary: { jp: "今回の学習ポイント 2件", en: "2 learning points" },
        topLessons: [
          {
            jp: "レイズで価値を取りに行く方が期待値を改善できる可能性があります。",
            replayCta: { labelJp: "リプレイを見る", labelEn: "View replay" },
          },
        ],
        detailLines: { jp: ["1. 価値を取り逃した場面"] },
        duplicateSuppression: { suppressedCount: 0 },
      },
    });
    expect(report.status).toBe("PASS");
    expect(report.mobileAudit.every((entry) => entry.result === "PASS")).toBe(true);
  });
});
