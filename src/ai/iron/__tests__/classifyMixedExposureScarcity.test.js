import { describe, expect, it } from "vitest";

import { summarizeMixedExposureScarcity } from "../classifyMixedExposureScarcity.js";

describe("Step44 mixed exposure scarcity classifier", () => {
  it("classifies table distribution bias when targeted table-size exposure is absent in mixed", () => {
    const report = summarizeMixedExposureScarcity({
      funnel: { exactOpportunities: 0, exactHits: 0 },
      divergence: { divergenceSource: "targeted-table-size-exposure-absent-in-mixed" },
      safety: { illegal: 0, freeze: 0 },
    });

    expect(report.classification).toBe("TABLE_DISTRIBUTION_BIAS");
    expect(report.naturalScarcityOrDistributionBias).toBe(true);
  });

  it("classifies matcher failure when opportunities exist without hits", () => {
    const report = summarizeMixedExposureScarcity({
      funnel: { exactOpportunities: 3, exactHits: 0 },
      divergence: {},
      safety: { illegal: 0, freeze: 0 },
    });

    expect(report.classification).toBe("MATCHER_FAILURE");
  });
});
