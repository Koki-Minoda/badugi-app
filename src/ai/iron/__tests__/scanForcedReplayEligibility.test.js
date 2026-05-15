import { describe, expect, it } from "vitest";

import { scanForcedReplayEligibility } from "../scanForcedReplayEligibility.js";

describe("scanForcedReplayEligibility", () => {
  it("promotes replay-validated clean signals to forced replay readiness only", () => {
    const report = scanForcedReplayEligibility({
      validations: [
        {
          signal: "S02 coverage-shadow stackDepth shallow",
          variant: "S02",
          bucket: "coverage-shadow stackDepth shallow",
          replaySampleCount: 5,
          deterministicReplay: true,
          invalidReplayCount: 0,
          illegal: 0,
          freeze: 0,
          signFlipRate: 0.1,
          repairRate: 0,
          entropyScore: 0.45,
          classification: "REPLAY_VALIDATED",
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
          classification: "MONITOR_ONLY",
          reason: ["closed-monitor-only"],
        },
      ],
      reproducibilitySignals: [
        {
          signal: "S02 coverage-shadow stackDepth shallow",
          deterministicReplay: true,
          mismatchCount: 0,
        },
        {
          signal: "S02 lowerMediumSDA5 bet-pressure",
          deterministicReplay: true,
          mismatchCount: 0,
        },
      ],
    });

    expect(report.readyCount).toBe(1);
    expect(report.monitorOnlyCount).toBe(1);
    expect(report.candidates[0].eligibility).toBe("FORCED_REPLAY_READY");
    expect(report.datasetRowsChanged).toBe(false);
  });
});
