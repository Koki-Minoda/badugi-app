import { describe, expect, it } from "vitest";

import { buildRLSignalPreviewSummary, classifyRLSignalCandidate } from "../buildRLSignalPreview.js";

describe("buildRLSignalPreview", () => {
  it("classifies strong coaching candidates as supervised signal previews", () => {
    const candidate = {
      exactHits: 5,
      estimatedEVGain: 32,
      legal: true,
      deterministic: true,
      replayAvailable: true,
    };
    expect(classifyRLSignalCandidate(candidate)).toBe("READY_FOR_SUPERVISED_SIGNAL");
    const report = buildRLSignalPreviewSummary({ candidates: [candidate] });
    expect(report.categories.READY_FOR_SUPERVISED_SIGNAL).toBe(1);
    expect(report.trainingDatasetMutation).toBe(false);
  });
});
