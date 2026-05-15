import { describe, expect, it } from "vitest";

import { decideS02Exportability } from "../decideS02Exportability.js";
import { focusedReportFixture } from "./s02CounterfactualFixtures.js";

describe("decideS02Exportability", () => {
  it("requires an isolated exportable sub-bucket before exportability", async () => {
    const report = await decideS02Exportability({
      focusedReport: focusedReportFixture,
      entropyReport: { classification: "LOW_ENTROPY" },
      repairReport: { verdict: "SAFE" },
      subBucketReport: { subBuckets: [{ verdict: "EXPORTABLE_CANDIDATE" }] },
    });

    expect(report.decision).toBe("EXPORTABLE");
    expect(report.metrics.exportableSubBucketCount).toBe(1);
  });

  it("falls back to counterfactual-only when signFlip is too high", async () => {
    const report = await decideS02Exportability({
      focusedReport: { ...focusedReportFixture, signFlipRate: 0.3 },
      entropyReport: { classification: "MODERATE_ENTROPY" },
      repairReport: { verdict: "SAFE" },
      subBucketReport: { subBuckets: [{ verdict: "EXPORTABLE_CANDIDATE" }] },
    });

    expect(report.decision).toBe("COUNTERFACTUAL_ONLY");
    expect(report.blockers).toContain("signFlip-too-high");
  });
});
