import { describe, expect, it } from "vitest";
import { auditCoachingMobileE2ESummary } from "../auditCoachingMobileE2E.js";

describe("auditCoachingMobileE2ESummary", () => {
  it("passes compact coaching lesson copy across Step49 viewports", () => {
    const report = auditCoachingMobileE2ESummary({
      viewModel: {
        lessons: [
          {
            jp: "この場面ではレイズで価値を取りに行く方が期待値を改善できる可能性があります。",
            en: "Raising may capture more value than checking back.",
            replayDeterministic: true,
          },
        ],
      },
    });
    expect(report.result).toBe("PASS");
    expect(report.viewports).toHaveLength(3);
  });
});

