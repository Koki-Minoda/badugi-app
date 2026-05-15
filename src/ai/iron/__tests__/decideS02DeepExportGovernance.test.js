import { describe, expect, it } from "vitest";

import { decideS02DeepExportGovernance } from "../decideS02DeepExportGovernance.js";

describe("decideS02DeepExportGovernance", () => {
  it("allows next-step export governance only when narrow replay evidence is stable", () => {
    const report = decideS02DeepExportGovernance({
      candidateReport: {
        candidates: [{ candidate: "deep RAISE vs CHECK", verdict: "EXPORTABLE_CANDIDATE" }],
      },
      crossBucketReport: { consistency: "CONSISTENT" },
      entropyReport: { classification: "MIXED" },
      determinismReport: { deterministic: true, invalidReplayCount: 0 },
    });

    expect(report.decision).toBe("SAFE_TO_EXPORT_NEXT");
    expect(report.exportableCandidates).toEqual(["deep RAISE vs CHECK"]);
    expect(report.datasetRowsChanged).toBe(false);
  });

  it("rejects inconsistent cross-bucket replay direction", () => {
    const report = decideS02DeepExportGovernance({
      candidateReport: {
        candidates: [{ candidate: "deep RAISE vs CHECK", verdict: "EXPORTABLE_CANDIDATE" }],
      },
      crossBucketReport: { consistency: "INCONSISTENT" },
      entropyReport: { classification: "LOW_ENTROPY" },
      determinismReport: { deterministic: true, invalidReplayCount: 0 },
    });

    expect(report.decision).toBe("DO_NOT_EXPORT");
    expect(report.reason).toContain("cross-bucket-inconsistent");
  });
});
