import { describe, expect, it } from "vitest";

import { recheckS02DeepAggregateStability } from "../recheckS02DeepAggregateStability.js";

describe("recheckS02DeepAggregateStability", () => {
  it("marks aggregate replay stable when expanded branch replay stays clean", () => {
    const report = recheckS02DeepAggregateStability({
      forcedReplayReport: {
        aggregate: {
          sampleCount: 100,
          validReplayCount: 100,
          invalidReplayCount: 0,
          meanDelta: 25,
          medianDelta: 0,
          signFlipRate: 0.04,
          confidence: 0.95,
          repairRate: 0,
          deterministicReplay: true,
        },
      },
    });

    expect(report.verdict).toBe("STABLE");
    expect(report.datasetRowsChanged).toBe(false);
  });
});
