import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getDefaultEvalOutputPath,
  MAJOR_10_VARIANTS,
  runProVsStandardEvaluationSuite,
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
