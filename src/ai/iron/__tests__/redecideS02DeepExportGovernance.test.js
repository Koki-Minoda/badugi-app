import { describe, expect, it } from "vitest";

import { redecideS02DeepExportGovernance } from "../redecideS02DeepExportGovernance.js";

describe("redecideS02DeepExportGovernance", () => {
  it("marks the candidate safe for next export only when both branches are confident", () => {
    const report = redecideS02DeepExportGovernance({
      branchReport: {
        allConfident: true,
        branches: [
          { playerCount: 3, verdict: "CONFIDENT", meanDelta: 20, invalidReplayCount: 0 },
          { playerCount: 4, verdict: "CONFIDENT", meanDelta: 30, invalidReplayCount: 0 },
        ],
      },
      aggregateReport: { verdict: "STABLE" },
      forcedReplayReport: { deterministicReplay: true, invalidReplayCount: 0 },
    });

    expect(report.decision).toBe("SAFE_TO_EXPORT_NEXT");
    expect(report.crossBucketConsistency).toBe("CONSISTENT");
    expect(report.datasetRowsChanged).toBe(false);
  });

  it("keeps underpowered branches in counterfactual governance", () => {
    const report = redecideS02DeepExportGovernance({
      branchReport: {
        allConfident: false,
        branches: [
          { playerCount: 3, verdict: "CONFIDENT", meanDelta: 20, invalidReplayCount: 0 },
          { playerCount: 4, verdict: "UNDERPOWERED", meanDelta: 30, invalidReplayCount: 0 },
        ],
      },
      aggregateReport: { verdict: "STABLE" },
      forcedReplayReport: { deterministicReplay: true, invalidReplayCount: 0 },
    });

    expect(report.decision).toBe("COUNTERFACTUAL_ONLY");
    expect(report.reason).toContain("branch-confidence-under-threshold");
  });
});
