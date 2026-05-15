import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getDefaultEvalOutputPath,
  MAJOR_10_VARIANTS,
  runProVsStandardEvaluationSuite,
  writeDivergenceReplaySamples,
  writeEvaluationJson,
} from "./runAiEvaluationBatch.js";

const __filename = fileURLToPath(import.meta.url);

export function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = "true"] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    hands: Number(options.hands ?? 40),
    seed: Number(options.seed ?? 20260506),
    playerCount: Number(options.playerCount ?? 6),
    maxStepsPerHand: Number(options.maxStepsPerHand ?? 300),
    options: {
      detailedTrace: String(options.detailedTrace ?? "false").toLowerCase() === "true",
      captureDivergence: String(options["capture-divergence"] ?? "false").toLowerCase() === "true",
      maxDivergenceSamples: Number(options["max-divergence-samples"] ?? 400),
      maxReplaySamples: Number(options["max-replay-samples"] ?? options["max-divergence-samples"] ?? 400),
      maxDivergenceRecords: Number(options["max-divergence-records"] ?? 600),
      divergenceSampleTag:
        String(options["capture-divergence"] ?? "false").toLowerCase() === "true"
          ? String(options["corpus-tag"] ?? options["divergence-sample-tag"] ?? "step4w")
          : String(options["corpus-tag"] ?? options["divergence-sample-tag"] ?? ""),
      divergenceBucketFilter:
        typeof options["divergence-bucket-filter"] === "string" && options["divergence-bucket-filter"].trim().length
          ? options["divergence-bucket-filter"].split(",").map((entry) => entry.trim()).filter(Boolean)
          : [],
      bucketSampleLimit: Number(options["bucket-sample-limit"] ?? 0),
      variantSampleLimit: Number(options["variant-sample-limit"] ?? 0),
      handClassSampleLimit: Number(options["handclass-sample-limit"] ?? 0),
      d01Targeted: String(options["d01-targeted"] ?? "false").toLowerCase() === "true",
      subbucketQuota: Number(options["subbucket-quota"] ?? 0),
      latePressureFocus: String(options["late-pressure-focus"] ?? "false").toLowerCase() === "true",
      targetPlayerCount: Number(options["target-player-count"] ?? 0),
      targetHandclass:
        typeof options["target-handclass"] === "string" && options["target-handclass"].trim().length
          ? options["target-handclass"].trim()
          : null,
    },
    variants:
      typeof options.variants === "string" && options.variants.trim().length
        ? options.variants.split(",").map((entry) => entry.trim()).filter(Boolean)
        : MAJOR_10_VARIANTS,
  };
}

export function formatEvaluationCliSummary(report, outputPath) {
  return {
    runId: report.runId,
    outputPath,
    variants: Object.fromEntries(
      Object.entries(report.variants).map(([variantId, result]) => [
        variantId,
        {
          status: result.status ?? "UNKNOWN",
          verdict: result.summary?.verdict ?? null,
          handsCompleted: result.handsCompleted ?? 0,
        },
      ]),
    ),
  };
}

async function withMutedConsole(callback) {
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
  };
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  try {
    return await callback();
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
  }
}

export async function runEvaluationCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = await withMutedConsole(() => runProVsStandardEvaluationSuite(options));
  const outputPath = getDefaultEvalOutputPath(options.seed);
  await writeEvaluationJson(report, outputPath);
  await writeDivergenceReplaySamples(report, { seed: options.seed });
  return {
    report,
    outputPath,
    summary: formatEvaluationCliSummary(report, outputPath),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const { summary } = await runEvaluationCli(process.argv.slice(2));
  console.log(JSON.stringify(summary, null, 2));
}
