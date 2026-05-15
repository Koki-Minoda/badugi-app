import { describe, expect, it } from "vitest";

import { auditShadowReplayDivergence } from "../auditShadowReplayDivergence.js";

describe("auditShadowReplayDivergence", () => {
  it("reports zero stackDepth divergence when replay samples match the shadow shape", () => {
    const report = auditShadowReplayDivergence({
      signals: [
        {
          signal: "S02 coverage-shadow stackDepth medium",
          variant: "S02",
          bucket: "coverage-shadow stackDepth medium",
          replaySampleCount: 4,
          requestedShape: { stackDepth: "medium" },
          stackDepthDistribution: [{ value: "medium", count: 4 }],
          playerCountDistribution: [{ value: "HU", count: 2 }, { value: "3way", count: 2 }],
          pressureFamilyDistribution: [{ value: "bet-pressure", count: 4 }],
          entropyScore: 0.45,
        },
      ],
    });

    expect(report.signals[0].stackDepthDivergence).toBe(0);
    expect(report.maxStackDepthDivergence).toBe(0);
    expect(report.signals[0].playerCountDivergence).toBe(1);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
