import { describe, expect, it } from "vitest";

import { summarizePromotionReadiness } from "../reviewPromotionReadiness.js";

describe("promotion readiness review", () => {
  it("marks clean repeatable robust validation ready for gated review", () => {
    const report = summarizePromotionReadiness({
      repeatability: { classification: "REPEATABLE" },
      robustness: { classification: "ROBUST" },
      determinism: { deterministic: true, mismatchCount: 0 },
      regression: { allIronProPositive: true, illegal: 0, freeze: 0 },
      fallback: { fallbackStable: true },
      concentration: { riskLevel: "LOW" },
    });

    expect(report.decision).toBe("READY_FOR_GATED_PROMOTION_REVIEW");
    expect(report.promoted).toBe(false);
    expect(report.routingChanged).toBe(false);
  });

  it("blocks readiness when mixed robustness is fragile", () => {
    const report = summarizePromotionReadiness({
      repeatability: { classification: "REPEATABLE" },
      robustness: { classification: "FRAGILE" },
      determinism: { deterministic: true, mismatchCount: 0 },
      regression: { allIronProPositive: true, illegal: 0, freeze: 0 },
      fallback: { fallbackStable: true },
      concentration: { riskLevel: "LOW" },
    });

    expect(report.decision).toBe("NOT_READY");
    expect(report.blockers).toContain("mixedRobust");
  });
});
