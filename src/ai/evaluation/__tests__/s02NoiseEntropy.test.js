import { describe, expect, it } from "vitest";

import {
  buildS02IsolationCandidates,
  classifyS02V3IsolationAxes,
  computeEntropyScore,
  summarizeS02OutcomeGroup,
} from "../analyzeS02V3NoiseEntropy.js";

describe("S02 v3 noise entropy", () => {
  it("classifies isolation axes without multi-axis assumptions", () => {
    const axes = classifyS02V3IsolationAxes({
      position: "button",
      drawRound: 1,
      actorSeat: 1,
      legalActions: [{ type: "FOLD" }, { type: "CALL", toCall: 10 }, { type: "RAISE", toCall: 10 }],
      state: {
        snapshot: {
          players: [{}, { stack: 300, betThisRound: 0 }],
          bigBlind: 20,
          metadata: { raiseCountThisRound: 1, lastBettingAction: { type: "CALL" } },
          currentBet: 10,
        },
      },
      facingAction: "raise",
    });
    expect(axes.position).toBe("button");
    expect(axes.toCall).toBe("6-10");
    expect(axes.pressureChain).toBe("firstRaiseAfterCall");
    expect(axes.drawStage).toBe("draw2");
    expect(axes.stackDepth).toBe("medium");
  });

  it("builds lower-entropy candidates when sign flips and repair rate improve", () => {
    const baseMetrics = {
      signFlipRate: 0.18,
      entropyScore: computeEntropyScore({ signFlipRate: 0.18, repairRate: 0.16, stdDev: 116, confidence: 1 }),
    };
    const axisBreakdown = {
      toCall: [
        { axis: "toCall", value: "<=5", sampleCount: 44, meanDelta: -120, signFlipRate: 0.05, confidence: 1, repairRate: 0.1, entropyScore: 0.11, acceptedInvalidReplayCount: 0 },
        { axis: "toCall", value: "16-20", sampleCount: 10, meanDelta: -80, signFlipRate: 0.3, confidence: 0.2, repairRate: 0.1, entropyScore: 0.42, acceptedInvalidReplayCount: 0 },
      ],
    };
    const candidates = buildS02IsolationCandidates({ baseMetrics, axisBreakdown });
    expect(candidates[0].axis).toBe("toCall");
    expect(candidates[0].value).toBe("<=5");
    expect(candidates[0].verdict).toBe("PROMISING");
  });

  it("summarizes repaired groups with accepted invalids held at zero", () => {
    const summary = summarizeS02OutcomeGroup([
      { ok: true, delta: -100, seed: 1, repairApplied: false, acceptedInvalidReplayCount: 0, deterministic: true },
      { ok: true, delta: -80, seed: 1, repairApplied: true, acceptedInvalidReplayCount: 0, deterministic: true },
      { ok: true, delta: -60, seed: 2, repairApplied: false, acceptedInvalidReplayCount: 0, deterministic: true },
    ], { axis: "position", value: "button" });
    expect(summary.sampleCount).toBe(3);
    expect(summary.acceptedInvalidReplayCount).toBe(0);
    expect(summary.repairRate).toBeCloseTo(1 / 3, 4);
    expect(summary.meanDelta).toBeLessThan(0);
  });
});
