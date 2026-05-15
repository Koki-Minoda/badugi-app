import { describe, expect, it } from "vitest";

import { validateReplayBackedSignals } from "../validateReplayBackedSignals.js";

describe("validateReplayBackedSignals", () => {
  it("classifies clean replay-backed shadows separately from closed monitor-only buckets", () => {
    const report = validateReplayBackedSignals({
      signals: [
        {
          signal: "S02 coverage-shadow stackDepth shallow",
          variant: "S02",
          bucket: "coverage-shadow stackDepth shallow",
          replaySampleCount: 5,
          deterministicReplay: true,
          invalidReplayCount: 0,
          illegal: 0,
          freeze: 0,
          signFlipRate: 0,
          repairRate: 0,
          entropyScore: 0.45,
        },
        {
          signal: "S02 lowerMediumSDA5 bet-pressure",
          variant: "S02",
          bucket: "lowerMediumSDA5 bet-pressure",
          replaySampleCount: 5,
          deterministicReplay: true,
          invalidReplayCount: 0,
          illegal: 0,
          freeze: 0,
          signFlipRate: 0.4333,
          repairRate: 0,
          entropyScore: 0.8,
          closureDecision: "DO_NOT_EXPORT",
          closureReason: ["signFlip-too-high"],
        },
      ],
    });

    expect(report.replayValidatedCount).toBe(1);
    expect(report.monitorOnlyCount).toBe(1);
    expect(report.signals[0].classification).toBe("REPLAY_VALIDATED");
    expect(report.signals[1].classification).toBe("MONITOR_ONLY");
    expect(report.datasetRowsChanged).toBe(false);
  });
});
