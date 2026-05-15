import { describe, expect, it } from "vitest";

import { reEvaluateS02ReplayStability } from "../reEvaluateS02ReplayStability.js";

describe("reEvaluateS02ReplayStability", () => {
  it("classifies depth stability from forced replay metrics", () => {
    const report = reEvaluateS02ReplayStability({
      forcedReplayReport: {
        depths: [
          { stackDepth: "shallow", sampleCount: 0, missingEngineBackedSamples: true },
          { stackDepth: "medium", sampleCount: 30, validReplays: 30, invalidReplays: 0, meanDelta: 10, signFlipRate: 0.3, confidence: 0.5, repairRate: 0, deterministicReplay: true },
          { stackDepth: "deep", sampleCount: 40, validReplays: 40, invalidReplays: 0, meanDelta: 20, signFlipRate: 0.05, confidence: 0.9, repairRate: 0, deterministicReplay: true },
        ],
      },
    });

    expect(report.rows.map((row) => row.verdict)).toEqual(["NO_SIGNAL", "VOLATILE", "STABLE"]);
    expect(report.stableCount).toBe(1);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
