import { describe, expect, it } from "vitest";

import {
  acquireS02DeepPlayerCountReplay,
  loadS02DeepPlayerCountReplaySamples,
} from "../acquireS02DeepPlayerCountReplay.js";

describe("acquireS02DeepPlayerCountReplay", () => {
  it("acquires engine-backed deep raise/check replay samples for playerCount branches", async () => {
    const samples = await loadS02DeepPlayerCountReplaySamples({ targetPerBranch: 2 });
    const report = await acquireS02DeepPlayerCountReplay({
      targetPerBranch: 2,
      sampleGroups: samples,
      outputPath: "reports/ai-iron/test-s02-deep-playercount-acquisition-step37.json",
    });

    expect(report.branches).toHaveLength(2);
    expect(report.branches.every((branch) => branch.sampleCount >= 2)).toBe(true);
    expect(report.noSyntheticInjection).toBe(true);
    expect(report.datasetRowsChanged).toBe(false);
  }, 30000);
});
