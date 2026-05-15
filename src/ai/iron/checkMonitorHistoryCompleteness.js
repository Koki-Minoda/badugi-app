import fs from "node:fs/promises";
import path from "node:path";

import { readIronMonitorHistory } from "./storeIronMonitorHistory.js";

export const DEFAULT_STEP26_HISTORY_COMPLETENESS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step26-history-completeness.json",
);

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function hasIronProGap(entry = {}) {
  const gaps = Object.values(entry?.ironProGap ?? {});
  return gaps.length > 0 && gaps.every(isFiniteNumber);
}

function missingFields(entry = {}) {
  const missing = [];
  if (typeof entry?.rawStatus !== "string" || !entry.rawStatus.length) missing.push("rawStatus");
  if (typeof entry?.hardenedStatus !== "string" || !entry.hardenedStatus.length) missing.push("hardenedStatus");
  if (!isFiniteNumber(entry?.datasetHitRate)) missing.push("datasetHitRate");
  if (!hasIronProGap(entry)) missing.push("ironProGap");
  if (typeof entry?.deterministicReplay !== "boolean") missing.push("deterministicReplay");
  return missing;
}

export function checkMonitorHistoryCompleteness({ history = [], minCompletedRuns = 5 } = {}) {
  const entries = Array.isArray(history) ? history : [];
  const runChecks = entries.map((entry, index) => {
    const missing = missingFields(entry);
    return {
      index,
      runId: String(entry?.runId ?? `run-${index + 1}`),
      complete: missing.length === 0,
      missing,
      rawStatus: entry?.rawStatus ?? null,
      hardenedStatus: entry?.hardenedStatus ?? null,
      deterministicReplay: entry?.deterministicReplay ?? null,
      promoted: Boolean(entry?.promoted),
      routingChanged: Boolean(entry?.routingChanged),
    };
  });
  const completedRuns = runChecks.filter((entry) => entry.complete).length;
  const promotedOrRoutingChangedRuns = runChecks.filter((entry) => entry.promoted || entry.routingChanged);
  const report = {
    historyEntries: entries.length,
    completedRuns,
    minCompletedRuns,
    checks: {
      completedRunsAtLeastMinimum: completedRuns >= minCompletedRuns,
      allRunsHaveRawStatus: runChecks.every((entry) => !entry.missing.includes("rawStatus")),
      allRunsHaveHardenedStatus: runChecks.every((entry) => !entry.missing.includes("hardenedStatus")),
      allRunsHaveDatasetHitRate: runChecks.every((entry) => !entry.missing.includes("datasetHitRate")),
      allRunsHaveIronProGap: runChecks.every((entry) => !entry.missing.includes("ironProGap")),
      allRunsHaveDeterministicReplay: runChecks.every((entry) => !entry.missing.includes("deterministicReplay")),
      noPromotedOrRoutingChangedRun: promotedOrRoutingChangedRuns.length === 0,
    },
    promotedOrRoutingChangedRuns,
    runChecks,
    outputPath: DEFAULT_STEP26_HISTORY_COMPLETENESS_OUTPUT_PATH,
  };
  return {
    ...report,
    status: Object.values(report.checks).every(Boolean) ? "PASS" : "FAIL",
  };
}

export async function writeMonitorHistoryCompleteness({
  history = null,
  minCompletedRuns = 5,
  outputPath = DEFAULT_STEP26_HISTORY_COMPLETENESS_OUTPUT_PATH,
} = {}) {
  const resolvedHistory = Array.isArray(history) ? history : await readIronMonitorHistory();
  const report = checkMonitorHistoryCompleteness({ history: resolvedHistory, minCompletedRuns });
  const resolved = { ...report, outputPath };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), "utf8");
  return resolved;
}

function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = "true"] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    minCompletedRuns: Number(options["min-completed-runs"] ?? 5),
    outputPath:
      typeof options.output === "string" && options.output.trim().length
        ? path.resolve(String(options.output))
        : DEFAULT_STEP26_HISTORY_COMPLETENESS_OUTPUT_PATH,
  };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeMonitorHistoryCompleteness(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
}
