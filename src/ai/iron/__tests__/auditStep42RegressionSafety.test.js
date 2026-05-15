import { describe, expect, it } from "vitest";

import { summarizeStep42RegressionSafety } from "../auditStep42RegressionSafety.js";

function arena({ illegal = 0, freeze = 0, gap = 1 } = {}) {
  return {
    results: [
      {
        variant: "S02",
        ironProGap: gap,
        illegal,
        freeze,
        bucketHitDistribution: { "S02 deep RAISE-vs-CHECK playerCount=3": 1 },
        candidateBucketObservations: { "S02 deep RAISE-vs-CHECK playerCount=3": 1 },
      },
    ],
  };
}

describe("Step42 regression safety audit", () => {
  it("passes clean deterministic arenas", () => {
    const report = summarizeStep42RegressionSafety({
      arenas: [arena(), arena({ gap: 2 })],
      determinism: { deterministic: true, mismatchCount: 0, invalidReplayCount: 0 },
    });

    expect(report.status).toBe("PASS");
    expect(report.verdict).toBe("SAFE");
  });

  it("fails illegal arenas", () => {
    const report = summarizeStep42RegressionSafety({
      arenas: [arena({ illegal: 1 })],
      determinism: { deterministic: true, mismatchCount: 0, invalidReplayCount: 0 },
    });

    expect(report.status).toBe("FAIL");
    expect(report.reason).toContain("illegal-action-present");
  });
});
