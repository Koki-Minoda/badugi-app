import { describe, expect, it } from "vitest";

import {
  buildS02SubbucketForcedReplayReport,
  runS02LowerMediumForcedReplay,
} from "../runForcedActionReplay.js";
import { loadFocusedS02Samples } from "../s02CounterfactualUtils.js";

async function withSuppressedDeckLogs(callback) {
  const originalLog = console.log;
  console.log = (...args) => {
    if (String(args[0] ?? "").includes("[DECK][STATE]")) return;
    originalLog(...args);
  };
  try {
    return await callback();
  } finally {
    console.log = originalLog;
  }
}

describe("S02 lowerMediumSDA5 forced replay", () => {
  it("runs a small focused forced replay batch and builds subbucket results", async () => {
    const report = await withSuppressedDeckLogs(() =>
      runS02LowerMediumForcedReplay({
        maxSamples: 2,
        actionA: "CALL",
        actionB: "FOLD",
        rolloutSeeds: [1],
      }),
    );
    const samples = await loadFocusedS02Samples({ maxSamples: 2 });
    const subbucketReport = buildS02SubbucketForcedReplayReport({ samples, results: report.results });

    expect(report.bucket).toBe("S02 lowerMediumSDA5 bet-pressure");
    expect(report.sampleCount).toBeGreaterThan(0);
    expect(report.validReplays + report.invalidReplays).toBe(report.sampleCount);
    expect(subbucketReport.subBuckets.length).toBeGreaterThan(0);
  }, 180000);
});
