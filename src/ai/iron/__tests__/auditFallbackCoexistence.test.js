import { describe, expect, it } from "vitest";

import { summarizeFallbackCoexistence } from "../auditFallbackCoexistence.js";

describe("fallback coexistence audit", () => {
  it("passes stable fallback rates", () => {
    const report = summarizeFallbackCoexistence({
      arena: {
        results: [
          { variant: "D02", datasetHitRate: 0.01, proFallbackRate: 0.99, illegal: 0, freeze: 0 },
          { variant: "S01", datasetHitRate: 0.02, proFallbackRate: 0.98, illegal: 0, freeze: 0 },
          { variant: "S02", datasetHitRate: 0.01, proFallbackRate: 0.99, illegal: 0, freeze: 0 },
        ],
      },
    });

    expect(report.status).toBe("PASS");
    expect(report.fallbackStable).toBe(true);
  });
});
