import { describe, expect, it } from "vitest";

import { scanS02DeepNarrowCandidates } from "../scanS02DeepNarrowCandidates.js";

describe("scanS02DeepNarrowCandidates", () => {
  it("classifies rows that meet replay, sign, confidence, and entropy thresholds", () => {
    const report = scanS02DeepNarrowCandidates({
      isolationReport: {
        rows: [
          { axis: "overall", bucket: "deep RAISE vs CHECK", sampleCount: 60, meanDelta: 20, signFlipRate: 0.05, confidence: 0.95, repairRate: 0, entropyScore: 0.2, invalidReplayCount: 0 },
          { axis: "playerCount", bucket: "playerCount=4", sampleCount: 20, meanDelta: 10, signFlipRate: 0.2, confidence: 0.7, repairRate: 0, entropyScore: 0.4, invalidReplayCount: 0 },
        ],
      },
    });

    expect(report.exportableCount).toBe(1);
    expect(report.candidates[0]).toMatchObject({ candidate: "deep RAISE vs CHECK", verdict: "EXPORTABLE_CANDIDATE" });
    expect(report.datasetRowsChanged).toBe(false);
  });
});
