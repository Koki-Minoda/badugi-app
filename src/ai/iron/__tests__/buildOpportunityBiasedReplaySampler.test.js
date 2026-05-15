import { describe, expect, it } from "vitest";

import { buildOpportunityBiasedReplaySampler } from "../buildOpportunityBiasedReplaySampler.js";

describe("build opportunity biased replay sampler", () => {
  it("builds a deterministic non-mutating sampler plan", async () => {
    const report = await buildOpportunityBiasedReplaySampler({
      outputPath: "reports/ai-iron/test-step41-opportunity-sampler.json",
      targetPerPlayerCount: 2,
      rows: [
        { type: "summary", exactOpportunityCount: 3, candidateReplayCount: 10 },
        { type: "opportunity", playerCount: 3 },
        { type: "opportunity", playerCount: 4 },
        { type: "opportunity", playerCount: 4 },
      ],
    });

    expect(report.selectedTotal).toBe(3);
    expect(report.targetCoverage).toBe(0.75);
    expect(report.hiddenStateInjection).toBe(false);
    expect(report.gameplayMutation).toBe(false);
    expect(report.samplerPlan).toHaveLength(2);
  });
});
