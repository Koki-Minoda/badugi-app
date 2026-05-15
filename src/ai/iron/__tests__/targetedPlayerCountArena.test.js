import { describe, expect, it } from "vitest";

import { runIronOfflineArena } from "../runIronOfflineArena.js";
import { STEP16_TARGET_BUCKET } from "../profileS02RelaxedOpportunity.js";

describe("targeted player-count arena sampling", () => {
  it("respects targeted player-count controls without routing mutation", async () => {
    const report = await runIronOfflineArena({
      datasetPath: "data/ai/action-value/iron-step15-action-value.jsonl",
      variants: ["S02"],
      hands: 1,
      seeds: [20260707],
      targetBucket: STEP16_TARGET_BUCKET,
      targetedSampling: true,
      targetPlayerCount: 3,
      targetHandclass: "strongSDA5",
      targetPosition: "IP",
      targetCallBand: "small",
      targetPressureChain: ["firstRaiseAfterCall", "repeatedPressure"],
      targetMinExactOpportunities: 1,
      maxHands: 1,
      maxDecisions: 100,
      outputPath: "reports/ai-iron/test-step17-targeted-arena.json",
      stabilityOutputPath: "reports/ai-iron/test-step17-targeted-arena-stability.json",
      dryRunGateOutputPath: "reports/ai-iron/test-step17-targeted-dryrun-gate.json",
    });

    expect(report.promoted).toBe(false);
    expect(report.eligibleForPromotion).toBe(false);
    expect(report.routingChanged).toBe(false);
    expect(report.targetPlayerCount).toBe(3);
    expect(report.targetHandclass).toBe("strongSDA5");
    expect(report.results[0].targetBucketProfile).toBeTruthy();
  }, 15000);
});
