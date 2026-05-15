import { describe, expect, it } from "vitest";

import { closeCoverageCandidate } from "../closeCoverageCandidate.js";

describe("closeCoverageCandidate", () => {
  it("closes S02 lowerMediumSDA5 as monitor-only do-not-export", () => {
    const report = closeCoverageCandidate({
      forcedReplay: {
        sampleCount: 30,
        validReplays: 30,
        invalidReplays: 0,
        meanDelta: 24,
        signFlipRate: 0.4333,
        confidence: 0.425,
        verdict: "COUNTERFACTUAL_ONLY",
      },
      exportabilityDecision: {
        blockers: ["signFlip-too-high", "confidence-too-low", "entropy-not-isolated"],
      },
    });

    expect(report.decision).toBe("DO_NOT_EXPORT");
    expect(report.status).toBe("COUNTERFACTUAL_ONLY");
    expect(report.monitorOnly).toBe(true);
    expect(report.reason).toEqual(["signFlip-too-high", "confidence-too-low", "entropy-not-isolated"]);
    expect(report.promoted).toBe(false);
    expect(report.routingChanged).toBe(false);
  });
});
