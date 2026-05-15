import { describe, expect, it } from "vitest";

import { classifyExposureRecoveryGateSummary } from "../classifyExposureRecoveryGate.js";

describe("classifyExposureRecoveryGate", () => {
  it("passes when natural exposure recovers exact hits without safety failures", () => {
    const report = classifyExposureRecoveryGateSummary({
      recovery: { exactOpportunities: 4, exactHits: 4, exactHitRate: 1 },
      safety: { status: "PASS", illegal: 0, freeze: 0, allIronProPositive: true, results: [{ ironProGap: 1 }] },
    });
    expect(report.gate).toBe("PASS");
  });

  it("fails when exact opportunities remain zero", () => {
    const report = classifyExposureRecoveryGateSummary({
      recovery: { exactOpportunities: 0, exactHits: 0, exactHitRate: 0 },
      safety: { status: "PASS", illegal: 0, freeze: 0, allIronProPositive: true },
    });
    expect(report.gate).toBe("FAIL");
  });
});
