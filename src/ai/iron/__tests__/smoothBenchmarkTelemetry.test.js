import { describe, expect, it } from "vitest";

import { smoothBenchmarkTelemetry } from "../smoothBenchmarkTelemetry.js";

describe("smoothBenchmarkTelemetry", () => {
  it("computes rolling benchmark averages", () => {
    const report = smoothBenchmarkTelemetry({
      runs: [
        { datasetHitRate: 0, ironProGap: 0.5, exactOpportunityRate: 0 },
        { datasetHitRate: 0.01, ironProGap: 1.5, exactOpportunityRate: 0.02 },
      ],
    });

    expect(report.rollingDatasetHitRate).toBe(0.005);
    expect(report.rollingIronProGap).toBe(1);
    expect(report.rollingExactOpportunityRate).toBe(0.01);
  });
});
