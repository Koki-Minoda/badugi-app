import { describe, expect, it } from "vitest";

import { auditS02DeepCrossBucketStability } from "../auditS02DeepCrossBucketStability.js";

describe("auditS02DeepCrossBucketStability", () => {
  it("marks positive exportable and counterfactual rows as consistent", () => {
    const report = auditS02DeepCrossBucketStability({
      candidateReport: {
        candidates: [
          { candidate: "deep RAISE vs CHECK", axis: "overall", verdict: "EXPORTABLE_CANDIDATE", sample: 60, meanDelta: 20, signFlipRate: 0.05, confidence: 0.95, entropy: 0.2 },
          { candidate: "playerCount=3", axis: "playerCount", verdict: "COUNTERFACTUAL_ONLY", sample: 30, meanDelta: 10, signFlipRate: 0, confidence: 0.75, entropy: 0 },
        ],
      },
    });

    expect(report.consistency).toBe("CONSISTENT");
    expect(report.directionConsistent).toBe(true);
    expect(report.datasetRowsChanged).toBe(false);
  });
});
