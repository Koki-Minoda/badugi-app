import { describe, expect, it } from "vitest";

import { classifyVerificationVerdict } from "../verifyStableNeighborBuckets.js";

describe("neighbor legality cleanup", () => {
  it("never marks accepted-invalid samples as expandable", () => {
    const verdict = classifyVerificationVerdict({
      sampleCount: 80,
      invalidReplayCount: 1,
      confidence: 1,
      signFlipRate: 0,
      meanDelta: -120,
      deterministicReplay: false,
    });
    expect(verdict).toBe("REJECTED");
  });
});
