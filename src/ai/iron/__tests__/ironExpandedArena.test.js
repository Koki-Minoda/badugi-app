import { describe, expect, it } from "vitest";

import { runIronOfflineArena } from "../runIronOfflineArena.js";

describe("iron expanded arena", () => {
  it("preserves dry-run safety and source attribution for expanded datasets", async () => {
    const result = await runIronOfflineArena({
      datasetPath: "data/ai/action-value/iron-step7-action-value.jsonl",
      variants: ["S01"],
      hands: 1,
      seeds: [20260524],
      outputPath: "reports/ai-iron/iron-step10-offline-arena-test.json",
      stabilityOutputPath: "reports/ai-iron/iron-step10-offline-arena-stability-test.json",
      dryRunGateOutputPath: "reports/ai-iron/iron-step10-dryrun-gate-test.json",
    });
    expect(result.promoted).toBe(false);
    expect(result.eligibleForPromotion).toBe(false);
    expect(result.routingChanged).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(Array.isArray(result.results[0].bucketAttribution)).toBe(true);
  }, 15000);
});
