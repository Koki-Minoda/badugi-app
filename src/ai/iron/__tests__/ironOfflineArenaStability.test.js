import { describe, expect, it } from "vitest";

import { runIronOfflineArena } from "../runIronOfflineArena.js";

describe("iron offline arena stability", () => {
  it("records per-seed summaries and confidence intervals for dry-run arena", async () => {
    const report = await runIronOfflineArena({
      datasetPath: "data/ai/action-value/iron-step7-action-value.jsonl",
      variants: ["D02"],
      hands: 1,
      seeds: [20260524, 20260525],
      outputPath: "reports/ai-iron/iron-step9-offline-arena-stability-test.json",
      stabilityOutputPath: "reports/ai-iron/iron-step9-offline-arena-stability-test-sidecar.json",
      dryRunGateOutputPath: "reports/ai-iron/iron-step9-dryrun-gate-test.json",
    });

    expect(report.arenaId).toBe("iron-step9");
    expect(report.promoted).toBe(false);
    expect(report.eligibleForPromotion).toBe(false);
    expect(report.routingChanged).toBe(false);
    expect(report.results).toHaveLength(1);
    expect(report.results[0].perSeed).toHaveLength(2);
    expect(report.results[0].confidenceInterval95.seeds).toBe(2);
  }, 20000);
});
