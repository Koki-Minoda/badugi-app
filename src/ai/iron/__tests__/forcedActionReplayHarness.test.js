import { describe, expect, it } from "vitest";

import { writeStep28Report } from "../s02CounterfactualUtils.js";
import { decideS02ForcedReplayExportability, DEFAULT_STEP29_EXPORTABILITY_OUTPUT_PATH } from "../decideS02Exportability.js";
import {
  DEFAULT_STEP29_DETERMINISM_OUTPUT_PATH,
  DEFAULT_STEP29_FORCED_REPLAY_OUTPUT_PATH,
  DEFAULT_STEP29_SUBBUCKET_FORCED_REPLAY_OUTPUT_PATH,
  buildForcedReplayDeterminismReport,
  buildS02SubbucketForcedReplayReport,
  runForcedActionReplay,
  runS02LowerMediumForcedReplay,
  writeForcedReplayDeterminismReport,
  writeS02SubbucketForcedReplayReport,
} from "../runForcedActionReplay.js";
import { loadFocusedS02Samples } from "../s02CounterfactualUtils.js";

function parseArgs() {
  const forwardedArgs = JSON.parse(process.env.MGX_IRON_FORCED_REPLAY_ARGS ?? "[]");
  const valueFor = (name, fallback = null) => {
    const prefix = `--${name}=`;
    const found = forwardedArgs.find((entry) => String(entry).startsWith(prefix));
    return typeof found === "string" ? found.slice(prefix.length) : fallback;
  };
  return {
    variant: valueFor("variant", "S02"),
    bucket: valueFor("bucket", "lowerMediumSDA5 bet-pressure"),
    corpusTag: valueFor("corpus-tag", "iron-step28"),
    maxSamples: Number(valueFor("max-samples", "2")),
    actionA: valueFor("action-a", "CALL"),
    actionB: valueFor("action-b", "FOLD"),
    rolloutPolicy: valueFor("rollout-policy", "pro-fallback"),
  };
}

async function withSuppressedLogs(callback) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...args) => {
    if (String(args[0] ?? "").includes("[DECK][STATE]")) return;
  };
  console.warn = () => {};
  try {
    return await callback();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

describe("Iron forced action replay Vitest harness", () => {
  it("writes S02 lowerMediumSDA5 forced replay, subbucket, determinism, and exportability reports", async () => {
    const args = parseArgs();
    expect(args.variant).toBe("S02");
    expect(args.bucket).toContain("lowerMediumSDA5");

    const mainReport = await withSuppressedLogs(() =>
      runS02LowerMediumForcedReplay({
        maxSamples: args.maxSamples,
        actionA: args.actionA,
        actionB: args.actionB,
        rolloutPolicy: args.rolloutPolicy,
        outputPath: DEFAULT_STEP29_FORCED_REPLAY_OUTPUT_PATH,
      }),
    );
    const samples = await loadFocusedS02Samples({ maxSamples: args.maxSamples });
    const subbucketReport = await writeS02SubbucketForcedReplayReport({
      samples,
      results: mainReport.results,
      outputPath: DEFAULT_STEP29_SUBBUCKET_FORCED_REPLAY_OUTPUT_PATH,
    });

    const determinismSamples = samples.slice(0, Math.min(20, samples.length));
    const secondRun = [];
    await withSuppressedLogs(async () => {
      for (const [index, sample] of determinismSamples.entries()) {
        secondRun.push(
          await runForcedActionReplay({
            sample,
            forcedActionA: args.actionA,
            forcedActionB: args.actionB,
            rolloutPolicy: args.rolloutPolicy,
            seed: Number(sample.seed ?? index),
            rolloutSeeds: [1],
          }),
        );
      }
    });
    const firstRun = mainReport.results.slice(0, determinismSamples.length);
    const determinismReport = await writeForcedReplayDeterminismReport({
      firstRun,
      secondRun,
      outputPath: DEFAULT_STEP29_DETERMINISM_OUTPUT_PATH,
    });

    const exportabilityReport = await writeStep28Report(
      DEFAULT_STEP29_EXPORTABILITY_OUTPUT_PATH,
      await decideS02ForcedReplayExportability({
        forcedReplayReport: mainReport,
        subBucketReport: subbucketReport,
      }),
    );

    expect(mainReport.sampleCount).toBeGreaterThan(0);
    expect(mainReport.validReplays + mainReport.invalidReplays).toBe(mainReport.sampleCount);
    expect(subbucketReport.subBuckets.length).toBeGreaterThan(0);
    expect(typeof determinismReport.deterministic).toBe("boolean");
    expect(["EXPORTABLE", "COUNTERFACTUAL_ONLY", "DO_NOT_TOUCH"]).toContain(exportabilityReport.decision);
  }, 900000);
});

export { buildForcedReplayDeterminismReport, buildS02SubbucketForcedReplayReport };
