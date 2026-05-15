import { describe, expect, it } from "vitest";

import {
  buildCoachingHandoffPackageSummary,
  candidateIdFor,
} from "../buildCoachingHandoffPackage.js";

const candidate = {
  variantId: "S02",
  spot: "deep RAISE-vs-CHECK",
  bucket: "S02 deep RAISE-vs-CHECK playerCount=3",
  playerCount: 3,
  ironAction: "RAISE",
  proAction: "CHECK",
  estimatedEVGain: 32.2,
  lessonTag: "missed-value",
  exactHits: 5,
  exactOpportunities: 5,
};

const row = {
  bucket: candidate.bucket,
  playerCount: 3,
  chosenBestAction: { type: "RAISE" },
  rejectedAction: { type: "CHECK" },
  forcedReplay: {
    sampleCount: 50,
    meanDelta: 32.2,
    signFlipRate: 0,
    confidence: 0.95,
    invalidReplayCount: 0,
    deterministicReplay: true,
  },
  metadata: { seed: 1, handId: 10, step: 4, replayDeterministic: true },
};

describe("buildCoachingHandoffPackage", () => {
  it("builds stable coaching handoff candidates without promotion flags", () => {
    expect(candidateIdFor(candidate)).toBe("S02_DEEP_RAISECHECK_PC3");
    const report = buildCoachingHandoffPackageSummary({
      candidates: [candidate],
      preexportRows: [row],
      repeatability: { runs: [{ run: "A", arenaId: "arena", playerCount3Hits: 2 }] },
    });
    expect(report.candidateCount).toBe(1);
    expect(report.candidates[0].replayReference.runId).toBe("step46-runA");
    expect(report.candidates[0].governance.promoted).toBe(false);
    expect(report.productionDatasetOverwrite).toBe(false);
  });
});
