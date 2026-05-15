import { describe, expect, it } from "vitest";

import { runIronOfflineArena } from "../runIronOfflineArena.js";
import { STEP16_TARGET_BUCKET } from "../profileS02RelaxedOpportunity.js";

describe("targeted arena sampling", () => {
  it("records target bucket profile without routing mutation", async () => {
    const report = await runIronOfflineArena({
      datasetPath: "data/ai/action-value/iron-step15-action-value.jsonl",
      variants: ["S02"],
      hands: 1,
      seeds: [20260624],
      targetBucket: STEP16_TARGET_BUCKET,
      targetedSampling: true,
      targetMinOpportunities: 1,
      outputPath: "reports/ai-iron/test-step16-targeted-arena.json",
      stabilityOutputPath: "reports/ai-iron/test-step16-targeted-arena-stability.json",
      dryRunGateOutputPath: "reports/ai-iron/test-step16-targeted-dryrun-gate.json",
    });

    expect(report.promoted).toBe(false);
    expect(report.eligibleForPromotion).toBe(false);
    expect(report.routingChanged).toBe(false);
    expect(report.results).toHaveLength(1);
    expect(report.results[0].targetBucketProfile).toBeTruthy();
    expect(report.results[0].targetBucketProfile.targetBucket).toBe(STEP16_TARGET_BUCKET);
  }, 15000);
});
