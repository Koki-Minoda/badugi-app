import { describe, expect, it } from "vitest";

import { expandS02DeepReplaySamples } from "../expandS02DeepReplaySamples.js";

describe("expandS02DeepReplaySamples", () => {
  it("compares Step34 and Step35 deep confidence after sample expansion", () => {
    const report = expandS02DeepReplaySamples({
      beforeReport: {
        depths: [{ stackDepth: "deep", sampleCount: 20, validReplays: 20, invalidReplays: 0, confidence: 0.45, signFlipRate: 0.08, meanDelta: 40 }],
      },
      afterReport: {
        depths: [{ stackDepth: "deep", sampleCount: 60, validReplays: 60, invalidReplays: 0, confidence: 0.9, signFlipRate: 0.05, meanDelta: 30, deterministicReplay: true }],
      },
    });

    expect(report.sampleBefore).toBe(20);
    expect(report.sampleAfter).toBe(60);
    expect(report.confidenceAfter).toBeGreaterThan(report.confidenceBefore);
    expect(report.invalidReplayCount).toBe(0);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
