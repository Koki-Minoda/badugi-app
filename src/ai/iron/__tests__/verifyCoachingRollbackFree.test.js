import { describe, expect, it } from "vitest";

import { verifyCoachingRollbackFreeSummary } from "../verifyCoachingRollbackFree.js";

describe("verifyCoachingRollbackFree", () => {
  it("passes when handoff artifacts are preview-only and deterministic", () => {
    const report = verifyCoachingRollbackFreeSummary({
      governance: {
        trainingDatasetMutation: false,
        routingChanged: false,
        gameplayMutation: false,
        sourcePriorityChanged: false,
        modelRegistryMutation: false,
        promoted: false,
        d01Excluded: true,
      },
      determinism: { deterministic: true, mismatchCount: 0, invalidReplayCount: 0 },
      handoff: { productionDatasetOverwrite: false },
      supervised: { trainingDatasetMutation: false },
    });
    expect(report.status).toBe("PASS");
    expect(report.rollbackRequired).toBe(false);
    expect(report.checks.replayDeterminismMaintained).toBe(true);
  });
});
