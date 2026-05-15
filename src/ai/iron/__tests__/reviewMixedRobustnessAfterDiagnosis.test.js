import { describe, expect, it } from "vitest";

import { summarizeMixedRobustnessAfterDiagnosis } from "../reviewMixedRobustnessAfterDiagnosis.js";

describe("Step44 mixed robustness review after diagnosis", () => {
  it("marks clean table-distribution scarcity as recoverable", () => {
    const report = summarizeMixedRobustnessAfterDiagnosis({
      scarcity: { classification: "TABLE_DISTRIBUTION_BIAS" },
      repeatability: { allRunsHaveExactHits: true },
      safety: { verdict: "SAFE", illegal: 0, freeze: 0 },
    });

    expect(report.classification).toBe("RECOVERABLE");
  });
});
