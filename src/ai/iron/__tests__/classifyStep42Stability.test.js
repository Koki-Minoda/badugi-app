import { describe, expect, it } from "vitest";

import { classifyStep42StabilitySummary } from "../classifyStep42Stability.js";

describe("classify Step42 stability", () => {
  it("classifies repeatable exposure when every gate is clean", () => {
    const report = classifyStep42StabilitySummary({
      repeatability: {
        allRunsHaveExactOpportunities: true,
        allRunsHaveExactHits: true,
        allRunsIronProPositive: true,
        illegal: 0,
        freeze: 0,
      },
      determinism: { deterministic: true, mismatchCount: 0, invalidReplayCount: 0 },
    });

    expect(report.classification).toBe("REPEATABLE");
  });

  it("classifies unstable determinism breaks", () => {
    const report = classifyStep42StabilitySummary({
      repeatability: {
        allRunsHaveExactOpportunities: true,
        allRunsHaveExactHits: true,
        allRunsIronProPositive: true,
        illegal: 0,
        freeze: 0,
      },
      determinism: { deterministic: false, mismatchCount: 1, invalidReplayCount: 0 },
    });

    expect(report.classification).toBe("UNSTABLE");
  });
});
