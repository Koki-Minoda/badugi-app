import { describe, expect, it } from "vitest";

import {
  buildSupervisedSignalHandoffSummary,
  classifySupervisedSignal,
} from "../buildSupervisedSignalHandoff.js";

const candidate = {
  bucket: "S02 deep RAISE-vs-CHECK playerCount=4",
  playerCount: 4,
  variantId: "S02",
  ironAction: "RAISE",
  proAction: "CHECK",
  exactHits: 12,
  exactOpportunities: 12,
  legal: true,
  deterministic: true,
};

const row = {
  bucket: candidate.bucket,
  forcedReplay: {
    confidence: 0.95,
    signFlipRate: 0.0417,
    invalidReplayCount: 0,
    deterministicReplay: true,
  },
};

describe("buildSupervisedSignalHandoff", () => {
  it("classifies clean exact-hit candidates as supervised training handoff", () => {
    expect(classifySupervisedSignal({ candidate, row })).toBe("READY_FOR_SUPERVISED_TRAINING");
    const report = buildSupervisedSignalHandoffSummary({ candidates: [candidate], preexportRows: [row] });
    expect(report.categories.READY_FOR_SUPERVISED_TRAINING).toBe(1);
    expect(report.trainingDatasetMutation).toBe(false);
  });
});
