import { describe, expect, it, vi } from "vitest";

import { runIronBenchmarkTelemetry } from "../runIronBenchmarkTelemetry.js";

describe("runIronBenchmarkTelemetry", () => {
  it("assembles telemetry without mutating dataset or routing", async () => {
    const arenaRunner = vi.fn(async () => ({
      promoted: false,
      routingChanged: false,
      dryRunEligibility: { reasonD01Excluded: "kept" },
      results: [
        { variant: "D02", ironProGap: 1, illegal: 0, freeze: 0, datasetHitRate: 0.01, proFallbackRate: 0.99 },
        { variant: "S01", ironProGap: 1, illegal: 0, freeze: 0, datasetHitRate: 0.01, proFallbackRate: 0.99 },
        { variant: "S02", ironProGap: 1, illegal: 0, freeze: 0, datasetHitRate: 0.01, proFallbackRate: 0.99 },
      ],
    }));
    const baselineLoader = vi.fn(async () => ({
      dataset: "data/ai/action-value/iron-step15-action-value.jsonl",
      variants: ["D02", "S01", "S02"],
      freezeDecision: {
        sameActionRate: 1,
        differentActionRate: 0,
        meanEVDelta: 0,
      },
      shadowTelemetryPolicy: { shadowTelemetryEnabled: true },
      priorityOrdering: [{ sourceType: "stable-bucket" }],
    }));
    const driftWriter = vi.fn(async () => ({
      status: "PASS",
      warnings: [],
      failures: [],
      checks: [],
    }));

    const telemetry = await runIronBenchmarkTelemetry({
      outputPath: "/tmp/iron-step23-benchmark-telemetry.json",
      determinismData: {
        deterministic: true,
        mismatchCount: 0,
        invalidReplayCount: 0,
      },
      baselineArenaReport: {
        results: [
          { variant: "D02", datasetHitRate: 0.01 },
          { variant: "S01", datasetHitRate: 0.01 },
          { variant: "S02", datasetHitRate: 0.01 },
        ],
      },
      arenaRunner,
      baselineLoader,
      driftWriter,
    });

    expect(telemetry.monitoringRunId).toBe("iron-step23");
    expect(telemetry.promoted).toBe(false);
    expect(telemetry.routingChanged).toBe(false);
    expect(arenaRunner).toHaveBeenCalled();
  });
});
