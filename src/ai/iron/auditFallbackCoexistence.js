import path from "node:path";

import { average, readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP43_MIXED_ARENA_PATH = path.resolve("reports/ai-iron/iron-step43-mixed-arena.json");
export const DEFAULT_STEP43_FALLBACK_COEXISTENCE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step43-fallback-coexistence.json",
);

function stddev(values = []) {
  const numeric = values.map(Number).filter(Number.isFinite);
  if (numeric.length <= 1) return 0;
  const mean = average(numeric);
  return Math.sqrt(numeric.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (numeric.length - 1));
}

export function summarizeFallbackCoexistence({ arena = {} } = {}) {
  const rows = (arena.results ?? []).map((result) => ({
    variant: result.variant,
    datasetHitRate: roundNumber(result.datasetHitRate, 6),
    proFallbackRate: roundNumber(result.proFallbackRate ?? result.fallback, 6),
    datasetHits: Number(result.ironActionSourceBreakdown?.["dataset-hit"] ?? 0),
    proFallbacks: Number(result.ironActionSourceBreakdown?.["pro-fallback"] ?? 0),
    illegal: Number(result.illegal ?? 0),
    freeze: Number(result.freeze ?? 0),
  }));
  const fallbackRates = rows.map((row) => row.proFallbackRate);
  const datasetHitRates = rows.map((row) => row.datasetHitRate);
  const illegal = rows.reduce((sum, row) => sum + row.illegal, 0);
  const freeze = rows.reduce((sum, row) => sum + row.freeze, 0);
  const fallbackOscillation = roundNumber(Math.max(...fallbackRates, 0) - Math.min(...fallbackRates, 1), 6);
  const fallbackStable =
    rows.length > 0 &&
    rows.every((row) => row.proFallbackRate >= 0 && row.proFallbackRate <= 1) &&
    fallbackOscillation <= 0.05 &&
    illegal === 0 &&
    freeze === 0;
  return {
    generatedAt: new Date().toISOString(),
    arenaId: arena.arenaId ?? null,
    status: fallbackStable ? "PASS" : "WARN",
    reason: fallbackStable ? ["fallback-layer-stable"] : ["fallback-coexistence-needs-review"],
    fallbackStable,
    fallbackOscillation,
    proFallbackRateMean: roundNumber(average(fallbackRates), 6),
    proFallbackRateStddev: roundNumber(stddev(fallbackRates), 6),
    datasetHitRateMean: roundNumber(average(datasetHitRates), 6),
    datasetHitRateStddev: roundNumber(stddev(datasetHitRates), 6),
    illegal,
    freeze,
    results: rows,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function auditFallbackCoexistence({
  arenaPath = DEFAULT_STEP43_MIXED_ARENA_PATH,
  outputPath = DEFAULT_STEP43_FALLBACK_COEXISTENCE_OUTPUT_PATH,
  arena = null,
} = {}) {
  const report = summarizeFallbackCoexistence({ arena: arena ?? (await readJson(arenaPath)) });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditFallbackCoexistence();
  console.log(JSON.stringify(report, null, 2));
}
