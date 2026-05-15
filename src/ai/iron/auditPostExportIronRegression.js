import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP40_SMOKE_ARENA_PATH = path.resolve("reports/ai-iron/iron-step40-smoke-arena.json");
export const DEFAULT_STEP40_REGRESSION_AUDIT_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step40-regression-audit.json",
);

function classifyRegression({ illegal = 0, freeze = 0, worstIronProGap = 0 } = {}) {
  if (illegal > 0 || freeze > 0) return "FAIL";
  if (worstIronProGap < -50) return "FAIL";
  if (worstIronProGap < -20) return "WARN";
  return "PASS";
}

export function summarizePostExportIronRegression(arena = {}) {
  const rows = (arena.results ?? []).map((result) => ({
    variant: result.variant,
    ironEv: roundNumber(result.ironEv, 4),
    proEv: roundNumber(result.proEv, 4),
    standardEv: roundNumber(result.standardEv, 4),
    ironProGap: roundNumber(result.ironProGap, 4),
    ironStandardGap: roundNumber(result.ironStandardGap, 4),
    datasetHitRate: roundNumber(result.datasetHitRate, 4),
    proFallbackRate: roundNumber(result.proFallbackRate, 4),
    illegal: Number(result.illegal ?? 0),
    freeze: Number(result.freeze ?? 0),
  }));
  const illegal = rows.reduce((sum, row) => sum + row.illegal, 0);
  const freeze = rows.reduce((sum, row) => sum + row.freeze, 0);
  const worstIronProGap = rows.reduce(
    (worst, row) => Math.min(worst, Number(row.ironProGap ?? 0)),
    Number.POSITIVE_INFINITY,
  );
  const status = classifyRegression({
    illegal,
    freeze,
    worstIronProGap: Number.isFinite(worstIronProGap) ? worstIronProGap : 0,
  });
  const reasons = [];
  if (illegal > 0) reasons.push("illegal-action-present");
  if (freeze > 0) reasons.push("freeze-present");
  if ((Number.isFinite(worstIronProGap) ? worstIronProGap : 0) < -50) reasons.push("catastrophic-iron-pro-regression");
  if (!reasons.length) reasons.push("no-catastrophic-regression");
  return {
    generatedAt: new Date().toISOString(),
    arenaId: arena.arenaId ?? null,
    datasetPath: arena.datasetPath ?? null,
    status,
    reason: reasons,
    illegal,
    freeze,
    worstIronProGap: roundNumber(Number.isFinite(worstIronProGap) ? worstIronProGap : 0, 4),
    results: rows,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function auditPostExportIronRegression({
  arenaPath = DEFAULT_STEP40_SMOKE_ARENA_PATH,
  outputPath = DEFAULT_STEP40_REGRESSION_AUDIT_OUTPUT_PATH,
  arena = null,
} = {}) {
  const report = summarizePostExportIronRegression(arena ?? (await readJson(arenaPath)));
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditPostExportIronRegression();
  console.log(JSON.stringify(report, null, 2));
}
