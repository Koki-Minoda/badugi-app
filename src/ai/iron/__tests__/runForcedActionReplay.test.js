import { describe, expect, it } from "vitest";

import { loadFocusedS02Samples } from "../s02CounterfactualUtils.js";
import { runForcedActionReplay, summarizeForcedReplayResults } from "../runForcedActionReplay.js";

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

describe("runForcedActionReplay", () => {
  it("forces CALL versus FOLD from the same replay sample and returns EV delta metadata", async () => {
    const [sample] = await loadFocusedS02Samples({ maxSamples: 1 });
    const result = await withSuppressedDeckLogs(() =>
      runForcedActionReplay({
        sample,
        forcedActionA: "CALL",
        forcedActionB: "FOLD",
        rolloutPolicy: "pro-fallback",
        rolloutSeeds: [1],
      }),
    );

    expect(result.sampleId).toContain("S02");
    expect(result.forcedA).toBe("CALL");
    expect(result.forcedB).toBe("FOLD");
    expect(typeof result.valid).toBe("boolean");
    expect(result.metadata.firstActionOnlyForced).toBe(true);
    expect(result.metadata.staleActionRepair).toBe(false);
  }, 120000);

  it("summarizes forced replay results", () => {
    const report = summarizeForcedReplayResults([
      { valid: true, delta: 10, repairUsed: false },
      { valid: true, delta: 5, repairUsed: false },
      { valid: true, delta: -2, repairUsed: false },
    ]);

    expect(report.sampleCount).toBe(3);
    expect(report.validReplays).toBe(3);
    expect(report.invalidReplays).toBe(0);
    expect(report.signFlipRate).toBeGreaterThan(0);
  });
});
