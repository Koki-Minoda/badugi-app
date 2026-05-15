import { describe, expect, it } from "vitest";

import { classifyVerificationVerdict } from "../verifyStableNeighborBuckets.js";

describe("stableNeighborVerification", () => {
  it("accepts only high-confidence low-flip expandable neighbors", () => {
    expect(
      classifyVerificationVerdict({
        sampleCount: 12,
        invalidReplayCount: 0,
        confidence: 0.95,
        signFlipRate: 0.08,
        meanDelta: -42,
        deterministicReplay: true,
      }),
    ).toBe("VERIFIED_EXPANDABLE");
  });

  it("rejects noisy or non-improving candidates", () => {
    expect(
      classifyVerificationVerdict({
        sampleCount: 12,
        invalidReplayCount: 0,
        confidence: 0.95,
        signFlipRate: 0.3,
        meanDelta: -10,
        deterministicReplay: true,
      }),
    ).toBe("NOISY");
    expect(
      classifyVerificationVerdict({
        sampleCount: 12,
        invalidReplayCount: 0,
        confidence: 0.95,
        signFlipRate: 0.05,
        meanDelta: 4,
        deterministicReplay: true,
      }),
    ).toBe("REJECTED");
  });
});
