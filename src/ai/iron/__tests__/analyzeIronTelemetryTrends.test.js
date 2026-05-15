import { describe, expect, it } from "vitest";

import { analyzeIronTelemetryTrends } from "../analyzeIronTelemetryTrends.js";

describe("analyzeIronTelemetryTrends", () => {
  it("classifies sparse zero-only history", () => {
    const report = analyzeIronTelemetryTrends({
      history: [{ datasetHitRate: 0, ironProGap: { S02: 0 }, proFallbackRate: 1, exactOpportunityRate: 0 }],
    });
    expect(report.datasetHitRate).toBe("SPARSE");
    expect(report.exactOpportunity).toBe("SPARSE");
  });
});
