import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP43_MIXED_ARENA_PATH = path.resolve("reports/ai-iron/iron-step43-mixed-arena.json");
export const DEFAULT_STEP43_CROSS_VARIANT_REGRESSION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step43-cross-variant-regression.json",
);
export const STEP43_VARIANTS = ["D02", "S01", "S02"];

function classify({ illegal = 0, freeze = 0, worstIronProGap = 0, missingVariants = [], allPositive = false } = {}) {
  if (illegal > 0 || freeze > 0) return "FAIL";
  if (worstIronProGap < -50) return "FAIL";
  if (missingVariants.length || !allPositive) return "WARN";
  return "PASS";
}

export function summarizeCrossVariantRegression({ arena = {}, variants = STEP43_VARIANTS } = {}) {
  const results = arena.results ?? [];
  const rows = variants.map((variant) => {
    const result = results.find((entry) => entry.variant === variant) ?? {};
    return {
      variant,
      present: Boolean(result.variant),
      ironEv: roundNumber(result.ironEv, 4),
      proEv: roundNumber(result.proEv, 4),
      standardEv: roundNumber(result.standardEv, 4),
      ironProGap: roundNumber(result.ironProGap, 4),
      ironStandardGap: roundNumber(result.ironStandardGap, 4),
      datasetHitRate: roundNumber(result.datasetHitRate, 6),
      proFallbackRate: roundNumber(result.proFallbackRate ?? result.fallback, 6),
      illegal: Number(result.illegal ?? 0),
      freeze: Number(result.freeze ?? 0),
    };
  });
  const missingVariants = rows.filter((row) => !row.present).map((row) => row.variant);
  const illegal = rows.reduce((sum, row) => sum + row.illegal, 0);
  const freeze = rows.reduce((sum, row) => sum + row.freeze, 0);
  const presentRows = rows.filter((row) => row.present);
  const worstIronProGap = presentRows.reduce(
    (worst, row) => Math.min(worst, Number(row.ironProGap ?? 0)),
    Number.POSITIVE_INFINITY,
  );
  const allPositive = presentRows.length === variants.length && presentRows.every((row) => row.ironProGap > 0);
  const status = classify({
    illegal,
    freeze,
    worstIronProGap: Number.isFinite(worstIronProGap) ? worstIronProGap : 0,
    missingVariants,
    allPositive,
  });
  const reason = [];
  if (illegal > 0) reason.push("illegal-action-present");
  if (freeze > 0) reason.push("freeze-present");
  if ((Number.isFinite(worstIronProGap) ? worstIronProGap : 0) < -50) reason.push("catastrophic-iron-pro-regression");
  if (missingVariants.length) reason.push("variant-missing");
  if (!allPositive && !reason.length) reason.push("non-positive-iron-pro-gap");
  if (!reason.length) reason.push("all-variants-iron-pro-positive");
  return {
    generatedAt: new Date().toISOString(),
    arenaId: arena.arenaId ?? null,
    datasetPath: arena.datasetPath ?? null,
    status,
    reason,
    allIronProPositive: allPositive,
    worstIronProGap: roundNumber(Number.isFinite(worstIronProGap) ? worstIronProGap : 0, 4),
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

export async function auditCrossVariantRegression({
  arenaPath = DEFAULT_STEP43_MIXED_ARENA_PATH,
  outputPath = DEFAULT_STEP43_CROSS_VARIANT_REGRESSION_OUTPUT_PATH,
  arena = null,
} = {}) {
  const report = summarizeCrossVariantRegression({ arena: arena ?? (await readJson(arenaPath)) });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditCrossVariantRegression();
  console.log(JSON.stringify(report, null, 2));
}
