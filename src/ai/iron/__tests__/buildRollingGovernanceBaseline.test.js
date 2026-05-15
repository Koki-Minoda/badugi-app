import { describe, expect, it } from "vitest";

import { buildRollingGovernanceBaseline } from "../buildRollingGovernanceBaseline.js";

describe("buildRollingGovernanceBaseline", () => {
  it("builds rolling metrics from last completed runs", () => {
    const report = buildRollingGovernanceBaseline({
      history: [
        { datasetHitRate: 0.002, ironProGap: { D02: 1, S01: 1, S02: 1 } },
        { datasetHitRate: 0, ironProGap: { D02: 0, S01: 0, S02: 0 } },
      ],
    });
    expect(report.rollingDatasetHitRate).toBe(0.001);
    expect(report.sampleCount).toBe(2);
  });
});
