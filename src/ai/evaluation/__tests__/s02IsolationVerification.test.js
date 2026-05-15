import { describe, expect, it } from "vitest";

import { buildS02IsolationCandidates } from "../analyzeS02V3NoiseEntropy.js";

describe("S02 isolation verification", () => {
  it("keeps Step14 isolation to a single axis candidate list", () => {
    const report = {
      baseMetrics: { signFlipRate: 0.1681, entropyScore: 0.2205 },
      axisBreakdown: {
        position: [
          {
            axis: "position",
            value: "button",
            sampleCount: 52,
            meanDelta: -140,
            signFlipRate: 0.08,
            confidence: 1,
            repairRate: 0.12,
            entropyScore: 0.13,
            acceptedInvalidReplayCount: 0,
          },
        ],
        toCall: [
          {
            axis: "toCall",
            value: "16-20",
            sampleCount: 12,
            meanDelta: -50,
            signFlipRate: 0.25,
            confidence: 0.2,
            repairRate: 0.1,
            entropyScore: 0.4,
            acceptedInvalidReplayCount: 0,
          },
        ],
      },
    };
    const candidates = buildS02IsolationCandidates(report);
    expect(candidates.some((entry) => entry.axis === "position" && entry.verdict === "PROMISING")).toBe(true);
    expect(candidates.some((entry) => entry.axis === "toCall" && entry.verdict === "NEEDS_MORE_SAMPLES")).toBe(true);
  });
});
