import { describe, expect, it } from "vitest";

import { checkIronDatasetQuality } from "../checkIronDatasetQuality.js";

describe("variant balanced dataset quality", () => {
  it("requires at least three variants and caps single-variant share at 0.55", async () => {
    const result = await checkIronDatasetQuality({
      datasetPath: "data/ai/action-value/iron-step4-action-value.jsonl",
      determinismPath: "reports/ai-eval/replay-determinism-audit-iron-step4.json",
      counterfactualPath: "reports/ai-eval/counterfactual-score-d02-s01-s02-d01-iron-step4.json",
      outputPath: "reports/ai-iron/test-iron-step4-quality.json",
    });

    expect(result.okForSupervisedTraining).toBe(true);
    expect(result.okForIronCandidate).toBe(false);
    expect(result.eligibleForOfflineArena).toBe(false);
    expect(result.blockers).toContain("insufficient-variant-coverage-for-iron-candidate");
  });
});
