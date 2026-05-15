import { describe, expect, it } from "vitest";

import { acquireS02ShallowReplaySignals } from "../acquireS02ShallowReplaySignals.js";

describe("acquireS02ShallowReplaySignals", () => {
  it("audits engine-backed shallow replay acquisition without dataset mutation", async () => {
    const report = await acquireS02ShallowReplaySignals({
      outputPath: "reports/ai-iron/test-s02-shallow-replay-acquisition-step35.json",
    });

    expect(report.variant).toBe("S02");
    expect(report.deterministicReplay).toBe(true);
    expect(report.invalidReplayCount).toBe(0);
    expect(report.noSyntheticInjection).toBe(true);
    expect(report.datasetRowsChanged).toBe(false);
  }, 30000);
});
