import { describe, expect, it } from "vitest";

import { summarizeCrossVariantRegression } from "../auditCrossVariantRegression.js";

function arena(gaps = { D02: 1, S01: 1, S02: 1 }) {
  return {
    results: Object.entries(gaps).map(([variant, ironProGap]) => ({
      variant,
      ironProGap,
      ironEv: 10,
      proEv: 9,
      standardEv: 8,
      datasetHitRate: 0.01,
      proFallbackRate: 0.99,
      illegal: 0,
      freeze: 0,
    })),
  };
}

describe("cross variant regression audit", () => {
  it("passes when all variants keep positive Iron-Pro gap", () => {
    const report = summarizeCrossVariantRegression({ arena: arena() });

    expect(report.status).toBe("PASS");
    expect(report.allIronProPositive).toBe(true);
  });

  it("warns on non-positive but non-catastrophic gap", () => {
    const report = summarizeCrossVariantRegression({ arena: arena({ D02: 1, S01: -1, S02: 1 }) });

    expect(report.status).toBe("WARN");
    expect(report.reason).toContain("non-positive-iron-pro-gap");
  });
});
