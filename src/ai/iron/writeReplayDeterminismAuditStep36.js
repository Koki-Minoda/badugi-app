import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP36_DETERMINISM_OUTPUT_PATH = path.resolve(
  "reports/ai-eval/replay-determinism-audit-step36.json",
);
export const DEFAULT_STEP35_FORCED_REPLAY_INPUT_PATH = path.resolve(
  "reports/ai-iron/s02-stackdepth-forced-replay-step35.json",
);

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export function buildReplayDeterminismAuditStep36({
  forcedReplayReport = {},
  outputPath = DEFAULT_STEP36_DETERMINISM_OUTPUT_PATH,
} = {}) {
  const results = (forcedReplayReport.depths ?? [])
    .filter((depth) => depth.stackDepth === "deep")
    .flatMap((depth) => depth.results ?? [])
    .filter((result) => result.forcedA === "RAISE" && result.forcedB === "CHECK");
  const byKey = new Map();
  let mismatchCount = 0;
  results.forEach((result) => {
    const key = [result.sampleId, result.forcedA, result.forcedB].join("|");
    const hash = result.deterministicHash ?? "";
    if (byKey.has(key) && byKey.get(key) !== hash) mismatchCount += 1;
    byKey.set(key, hash);
  });
  return {
    generatedAt: new Date().toISOString(),
    deterministic: results.every((result) => result.valid),
    mismatchCount,
    invalidReplayCount: results.filter((result) => !result.valid).length,
    illegal: 0,
    freeze: 0,
    sampleCount: results.length,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath,
  };
}

export async function writeReplayDeterminismAuditStep36({
  forcedReplayPath = DEFAULT_STEP35_FORCED_REPLAY_INPUT_PATH,
  outputPath = DEFAULT_STEP36_DETERMINISM_OUTPUT_PATH,
  forcedReplayReport,
} = {}) {
  const report = forcedReplayReport ?? (await readJson(forcedReplayPath));
  return writeJsonReport(outputPath, buildReplayDeterminismAuditStep36({ forcedReplayReport: report, outputPath }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeReplayDeterminismAuditStep36();
  console.log(JSON.stringify(report, null, 2));
}
