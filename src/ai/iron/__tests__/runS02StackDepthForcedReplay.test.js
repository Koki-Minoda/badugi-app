import { describe, expect, it } from "vitest";

import {
  buildS02StackDepthForcedReplayDeterminism,
  writeS02StackDepthForcedReplayDeterminism,
  loadS02StackDepthReplaySamples,
  runS02StackDepthForcedReplay,
} from "../runS02StackDepthForcedReplay.js";
import { writeS02StackDepthStabilityAudit } from "../auditS02StackDepthStability.js";
import { writeS02CrossDepthConsistency } from "../checkS02CrossDepthConsistency.js";
import { writeS02StackDepthExportability } from "../decideS02StackDepthExportability.js";
import { acquireS02ShallowReplaySignals } from "../acquireS02ShallowReplaySignals.js";
import { writeS02MediumSignFlipIsolation } from "../isolateS02MediumSignFlip.js";
import { writeS02DeepReplaySampleExpansion } from "../expandS02DeepReplaySamples.js";
import { writeS02ActionPairIsolation } from "../isolateS02ActionPairs.js";
import { writeS02ReplayStabilityReevaluation } from "../reEvaluateS02ReplayStability.js";
import { writeS02ExportabilityRecheck } from "../recheckS02Exportability.js";
import { writeGovernanceFreezeVerificationStep35 } from "../verifyGovernanceFreezeStep35.js";

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

describe("runS02StackDepthForcedReplay", () => {
  it("loads actual S02 replay samples by stackDepth without creating dataset rows", async () => {
    const samples = await loadS02StackDepthReplaySamples({ maxSamplesPerDepth: 2 });

    expect(samples.deep.length).toBeGreaterThan(0);
    expect(samples.medium.length).toBeGreaterThan(0);
    expect(samples.shallow.length).toBe(0);
  }, 30000);

  it("runs a small forced replay for available stackDepth samples", async () => {
    const report = await withSuppressedDeckLogs(() =>
      runS02StackDepthForcedReplay({
        maxSamplesPerDepth: 1,
        depths: ["medium", "deep"],
        rolloutSeeds: [1],
        outputPath: "reports/ai-iron/test-s02-stackdepth-forced-replay-step34.json",
      }),
    );
    const determinism = buildS02StackDepthForcedReplayDeterminism({ forcedReplayReport: report });

    expect(report.depths).toHaveLength(2);
    expect(report.sampleCount).toBeGreaterThan(0);
    expect(report.datasetRowsChanged).toBe(false);
    expect(determinism.mismatchCount).toBe(0);
  }, 120000);

  const maybeIt = process.env.MGX_IRON_STEP34_WRITE_REPORTS === "1" ? it : it.skip;
  maybeIt("writes Step34 stackDepth forced replay reports", async () => {
    const forcedReplayReport = await withSuppressedDeckLogs(() =>
      runS02StackDepthForcedReplay({
        maxSamplesPerDepth: 20,
        depths: ["shallow", "medium", "deep"],
        rolloutSeeds: [1],
      }),
    );
    await writeS02StackDepthForcedReplayDeterminism({ forcedReplayReport });
    const stabilityReport = await writeS02StackDepthStabilityAudit({ forcedReplayReport });
    const consistencyReport = await writeS02CrossDepthConsistency({ stabilityReport });
    const exportabilityReport = await writeS02StackDepthExportability({ stabilityReport, consistencyReport });

    expect(forcedReplayReport.depths).toHaveLength(3);
    expect(stabilityReport.rows).toHaveLength(3);
    expect(["CONSISTENT", "PARTIAL", "INCONSISTENT", "NO_SIGNAL"]).toContain(consistencyReport.consistency);
    expect(["EXPORTABLE_CANDIDATE", "COUNTERFACTUAL_ONLY", "MONITOR_ONLY", "DO_NOT_EXPORT"]).toContain(
      exportabilityReport.decision,
    );
  }, 900000);

  const maybeStep35It = process.env.MGX_IRON_STEP35_WRITE_REPORTS === "1" ? it : it.skip;
  maybeStep35It("writes Step35 shallow acquisition and isolation reports", async () => {
    await acquireS02ShallowReplaySignals();
    const forcedReplayReport = await withSuppressedDeckLogs(() =>
      runS02StackDepthForcedReplay({
        maxSamplesPerDepth: 60,
        depths: ["shallow", "medium", "deep"],
        rolloutSeeds: [1],
        outputPath: "reports/ai-iron/s02-stackdepth-forced-replay-step35.json",
      }),
    );
    await writeS02StackDepthForcedReplayDeterminism({
      forcedReplayReport,
      outputPath: "reports/ai-eval/replay-determinism-audit-step35.json",
    });
    await writeS02MediumSignFlipIsolation({ forcedReplayReport });
    await writeS02DeepReplaySampleExpansion({ afterReport: forcedReplayReport });
    await writeS02ActionPairIsolation({ forcedReplayReport });
    const stabilityReport = await writeS02ReplayStabilityReevaluation({ forcedReplayReport });
    await writeS02ExportabilityRecheck({ stabilityReport });
    await writeGovernanceFreezeVerificationStep35();

    expect(forcedReplayReport.depths).toHaveLength(3);
    expect(stabilityReport.rows).toHaveLength(3);
  }, 900000);
});
