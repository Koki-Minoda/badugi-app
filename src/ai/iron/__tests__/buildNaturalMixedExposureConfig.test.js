import { describe, expect, it } from "vitest";

import { buildNaturalMixedExposureConfig } from "../buildNaturalMixedExposureConfig.js";
import { naturalMixedExposurePlayerCount, summarizeTableSizeDistribution } from "../runIronOfflineArena.js";

describe("buildNaturalMixedExposureConfig", () => {
  it("builds a natural exposure config without injection or mutation", () => {
    const report = buildNaturalMixedExposureConfig({ hands: 12 });
    expect(report.tableSizeWeights).toEqual({ "6max": 0.5, "4max": 0.25, "3way": 0.25 });
    expect(report.usesSyntheticInjection).toBe(false);
    expect(report.usesHiddenStateMutation).toBe(false);
    expect(report.usesGameplayMutation).toBe(false);
    expect(report.promoted).toBe(false);
    expect(report.routingChanged).toBe(false);
  });

  it("uses a deterministic 6/6/4/3 table schedule", () => {
    const counts = { "6max": 0, "4max": 0, "3way": 0 };
    for (let handIndex = 0; handIndex < 12; handIndex += 1) {
      const count = naturalMixedExposurePlayerCount(handIndex, 0);
      counts[count === 3 ? "3way" : count === 4 ? "4max" : "6max"] += 1;
    }
    expect(summarizeTableSizeDistribution(counts)).toEqual({ "6max": 0.5, "4max": 0.25, "3way": 0.25 });
  });
});
