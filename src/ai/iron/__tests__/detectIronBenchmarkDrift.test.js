import { describe, expect, it } from "vitest";

import { detectIronBenchmarkDrift } from "../detectIronBenchmarkDrift.js";

function buildBaseline() {
  return {
    arena: {
      results: [
        { variant: "D02", datasetHitRate: 0.01 },
        { variant: "S01", datasetHitRate: 0.01 },
        { variant: "S02", datasetHitRate: 0.01 },
      ],
    },
    priorityOrdering: [{ sourceType: "stable-bucket" }],
  };
}

function buildCurrent(overrides = {}) {
  return {
    freezeDecision: {
      sameActionRate: 1,
      differentActionRate: 0,
      meanEVDelta: 0,
    },
    determinism: {
      deterministic: true,
      invalidReplayCount: 0,
    },
    priorityOrdering: [{ sourceType: "stable-bucket" }],
    arena: {
      promoted: false,
      routingChanged: false,
      dryRunEligibility: { reasonD01Excluded: "no STABLE_STANDARD_BETTER bucket; STABLE_PRO_BETTER only" },
      results: [
        { variant: "D02", ironProGap: 1, illegal: 0, freeze: 0, datasetHitRate: 0.01 },
        { variant: "S01", ironProGap: 1, illegal: 0, freeze: 0, datasetHitRate: 0.01 },
        { variant: "S02", ironProGap: 1, illegal: 0, freeze: 0, datasetHitRate: 0.01 },
      ],
    },
    ...overrides,
  };
}

describe("detectIronBenchmarkDrift", () => {
  it("passes a stable run", () => {
    const report = detectIronBenchmarkDrift({
      baseline: buildBaseline(),
      current: buildCurrent(),
    });
    expect(report.status).toBe("PASS");
  });

  it("warns on large dataset hit-rate drop", () => {
    const current = buildCurrent({
      arena: {
        promoted: false,
        routingChanged: false,
        dryRunEligibility: { reasonD01Excluded: "kept" },
        results: [
          { variant: "D02", ironProGap: 1, illegal: 0, freeze: 0, datasetHitRate: 0.001 },
          { variant: "S01", ironProGap: 1, illegal: 0, freeze: 0, datasetHitRate: 0.001 },
          { variant: "S02", ironProGap: 1, illegal: 0, freeze: 0, datasetHitRate: 0.001 },
        ],
      },
    });
    const report = detectIronBenchmarkDrift({ baseline: buildBaseline(), current });
    expect(report.status).toBe("WARN");
  });

  it("fails on negative iron-pro gap", () => {
    const current = buildCurrent({
      arena: {
        promoted: false,
        routingChanged: false,
        dryRunEligibility: { reasonD01Excluded: "kept" },
        results: [
          { variant: "D02", ironProGap: -0.1, illegal: 0, freeze: 0, datasetHitRate: 0.01 },
        ],
      },
    });
    const report = detectIronBenchmarkDrift({ baseline: buildBaseline(), current });
    expect(report.status).toBe("FAIL");
  });
});
