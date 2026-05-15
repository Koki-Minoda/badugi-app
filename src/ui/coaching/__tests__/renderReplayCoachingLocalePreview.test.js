import { describe, expect, it } from "vitest";
import { renderReplayCoachingLocalePreviewSummary } from "../renderReplayCoachingLocalePreview.js";

describe("renderReplayCoachingLocalePreviewSummary", () => {
  it("passes readable JP/EN annotation copy", () => {
    const report = renderReplayCoachingLocalePreviewSummary({
      annotations: {
        annotations: [
          {
            lessonId: "L1",
            jp: "この場面ではレイズの方が期待値を改善できる可能性があります。",
            en: "Raising may capture more value than checking back.",
          },
        ],
      },
    });
    expect(report.result).toBe("PASS");
    expect(report.locales).toEqual({ jp: "PASS", en: "PASS" });
  });
});

