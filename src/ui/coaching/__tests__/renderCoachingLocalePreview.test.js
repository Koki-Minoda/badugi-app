import { describe, expect, it } from "vitest";

import { renderCoachingLocalePreviewSummary } from "../renderCoachingLocalePreview.js";

describe("renderCoachingLocalePreview", () => {
  it("marks compact JP and EN copy as mobile safe", () => {
    const report = renderCoachingLocalePreviewSummary({
      viewModel: {
        lessons: [
          {
            lessonId: "lesson",
            jp: "深いスタックではレイズで価値を取りに行く方が期待値を改善できる可能性があります。",
            en: "In this deep-stack spot, raising may capture more value than checking back.",
          },
        ],
      },
    });
    expect(report.locales.jp).toBe("PASS");
    expect(report.locales.en).toBe("PASS");
    expect(report.mobileTruncationSafe).toBe(true);
  });
});
