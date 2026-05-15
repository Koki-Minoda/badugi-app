import { describe, expect, it } from "vitest";

import { summarizeNaturalOpportunityRecovery } from "../simulateNaturalOpportunityRecovery.js";

describe("Step44 natural opportunity recovery simulation", () => {
  it("keeps simulation non-mutating and marks recovery possible from targeted repeatability", () => {
    const report = summarizeNaturalOpportunityRecovery({
      mixedArena: {
        results: [
          {
            variant: "S02",
            ironActionSourceBreakdown: { "dataset-hit": 1, "pro-fallback": 99 },
          },
        ],
      },
      repeatability: { metrics: { exactOpportunities: { mean: 12 } } },
    });

    expect(report.simulationOnly).toBe(true);
    expect(report.syntheticOpportunityInjection).toBe(false);
    expect(report.recoveryPossible).toBe(true);
  });
});
