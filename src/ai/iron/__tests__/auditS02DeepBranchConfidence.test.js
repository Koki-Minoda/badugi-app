import { describe, expect, it } from "vitest";

import { auditS02DeepBranchConfidence } from "../auditS02DeepBranchConfidence.js";

describe("auditS02DeepBranchConfidence", () => {
  it("classifies confident and underpowered playerCount branches", () => {
    const report = auditS02DeepBranchConfidence({
      forcedReplayReport: {
        branches: [
          { playerCount: 3, sampleCount: 50, validReplayCount: 50, invalidReplayCount: 0, meanDelta: 20, signFlipRate: 0.05, confidence: 0.9, repairRate: 0, deterministicReplay: true },
          { playerCount: 4, sampleCount: 30, validReplayCount: 30, invalidReplayCount: 0, meanDelta: 20, signFlipRate: 0.05, confidence: 0.7, repairRate: 0, deterministicReplay: true },
        ],
      },
    });

    expect(report.branches.map((branch) => branch.verdict)).toEqual(["CONFIDENT", "UNDERPOWERED"]);
    expect(report.allConfident).toBe(false);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
