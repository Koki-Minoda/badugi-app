import { describe, expect, it } from "vitest";

import { auditS02StackDepthStability } from "../auditS02StackDepthStability.js";

describe("auditS02StackDepthStability", () => {
  it("marks missing depths as no replay signal and stable clean positives as stable", () => {
    const report = auditS02StackDepthStability({
      forcedReplayReport: {
        depths: [
          {
            stackDepth: "shallow",
            sampleCount: 0,
            validReplays: 0,
            invalidReplays: 0,
            meanDelta: 0,
            signFlipRate: 0,
            confidence: 0,
            repairRate: 0,
            missingEngineBackedSamples: true,
          },
          {
            stackDepth: "deep",
            sampleCount: 20,
            validReplays: 20,
            invalidReplays: 0,
            meanDelta: 10,
            medianDelta: 10,
            signFlipRate: 0,
            confidence: 0.8,
            repairRate: 0,
          },
        ],
      },
    });

    expect(report.rows[0].verdict).toBe("NO_REPLAY_SIGNAL");
    expect(report.rows[1].verdict).toBe("STABLE_POSITIVE");
    expect(report.datasetRowsChanged).toBe(false);
  });
});
