import { describe, expect, it } from "vitest";

import { recheckS02Exportability } from "../recheckS02Exportability.js";

describe("recheckS02Exportability", () => {
  it("promotes only stable replay-backed depths to exportable candidate", () => {
    const report = recheckS02Exportability({
      stabilityReport: {
        rows: [
          { depth: "deep", verdict: "STABLE", sampleCount: 40, invalidReplayCount: 0, repairRate: 0, signFlipRate: 0.05, confidence: 0.9, deterministicReplay: true, meanDelta: 20 },
        ],
      },
    });

    expect(report.decision).toBe("EXPORTABLE_CANDIDATE");
    expect(report.depthDecisions[0].exportable).toBe(true);
  });

  it("keeps volatile replay-backed candidates out of export", () => {
    const report = recheckS02Exportability({
      stabilityReport: {
        rows: [
          { depth: "medium", verdict: "VOLATILE", sampleCount: 40, invalidReplayCount: 0, repairRate: 0, signFlipRate: 0.25, confidence: 0.6, deterministicReplay: true, meanDelta: 20 },
        ],
      },
    });

    expect(report.decision).toBe("COUNTERFACTUAL_ONLY");
    expect(report.reason).toContain("signFlipRate>0.10");
    expect(report.datasetRowsChanged).toBe(false);
  });
});
