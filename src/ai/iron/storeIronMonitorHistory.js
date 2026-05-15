import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_IRON_MONITOR_HISTORY_DIR = path.resolve("reports/ai-iron/history");
export const DEFAULT_IRON_MONITOR_HISTORY_PATH = path.resolve(
  DEFAULT_IRON_MONITOR_HISTORY_DIR,
  "iron-monitor-history.jsonl",
);

function roundNumber(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

function average(values = []) {
  const list = values.map((value) => Number(value ?? 0)).filter(Number.isFinite);
  return list.length ? roundNumber(list.reduce((sum, value) => sum + value, 0) / list.length) : 0;
}

export function buildIronMonitorHistoryEntry({ telemetry = {} } = {}) {
  const results = Array.isArray(telemetry?.arena?.results) ? telemetry.arena.results : [];
  return {
    timestamp: new Date().toISOString(),
    runId: String(telemetry?.monitoringRunId ?? "iron-step25"),
    rawStatus: String(telemetry?.drift?.status ?? "PASS"),
    hardenedStatus: String(telemetry?.governance?.hardenedStatus ?? telemetry?.drift?.status ?? "PASS"),
    datasetHitRate: average(results.map((result) => result?.datasetHitRate ?? 0)),
    rollingDatasetHitRate: Number(telemetry?.governance?.rollingBaseline?.rollingDatasetHitRate ?? 0),
    ironProGap: Object.fromEntries(results.map((result) => [String(result?.variant ?? ""), Number(result?.ironProGap ?? 0)])),
    exactOpportunityRate: roundNumber(telemetry?.exactOpportunityRate ?? 0),
    sameActionRate: roundNumber(telemetry?.sameActionRate ?? 1),
    proFallbackRate: roundNumber(telemetry?.proFallbackRate ?? 1),
    deterministicReplay: Boolean(telemetry?.determinism?.deterministic),
    invalidReplayCount: Number(telemetry?.determinism?.invalidReplayCount ?? 0),
    promoted: Boolean(telemetry?.promoted),
    routingChanged: Boolean(telemetry?.routingChanged),
  };
}

export async function readIronMonitorHistory({
  historyPath = DEFAULT_IRON_MONITOR_HISTORY_PATH,
} = {}) {
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function storeIronMonitorHistory({
  telemetry = {},
  historyPath = DEFAULT_IRON_MONITOR_HISTORY_PATH,
} = {}) {
  const entry = buildIronMonitorHistoryEntry({ telemetry });
  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  await fs.appendFile(historyPath, `${JSON.stringify(entry)}\n`, "utf8");
  return {
    historyPath,
    entry,
  };
}
