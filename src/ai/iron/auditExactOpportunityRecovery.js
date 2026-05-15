import path from "node:path";

import { readJson, roundNumber, writeJsonReport } from "./coverageAuditUtils.js";
import { summarizeMixedExposureHits } from "./auditMixedExposureHits.js";
import { readPreExportRows } from "./validatePreExportPackage.js";

export const DEFAULT_STEP45_NATURAL_MIXED_ARENA_PATH = path.resolve(
  "reports/ai-iron/iron-step45-natural-mixed-arena.json",
);
export const DEFAULT_STEP45_EXACT_RECOVERY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step45-exact-opportunity-recovery.json",
);
export const DEFAULT_STEP43_MIXED_HIT_AUDIT_PATH = path.resolve("reports/ai-iron/step43-mixed-hit-audit.json");
export const DEFAULT_STEP42_REPEATABILITY_SUMMARY_PATH = path.resolve("reports/ai-iron/step42-repeatability-summary.json");

function playerCountMetric(hitAudit = {}, playerCount = 3, key = "hits") {
  const entry = (hitAudit.byPlayerCount ?? []).find((row) => Number(row.playerCount ?? 0) === Number(playerCount));
  return Number(entry?.[key] ?? 0);
}

export function summarizeExactOpportunityRecovery({
  step43 = {},
  step45Arena = {},
  step42 = {},
  rows = [],
} = {}) {
  const step45 = summarizeMixedExposureHits({ arena: step45Arena, rows });
  const playerCounts = [3, 4].map((playerCount) => ({
    playerCount,
    opportunities: playerCountMetric(step45, playerCount, "opportunities"),
    hits: playerCountMetric(step45, playerCount, "hits"),
    hitRate: roundNumber(playerCountMetric(step45, playerCount, "hits") / Math.max(1, playerCountMetric(step45, playerCount, "opportunities")), 4),
    step43Opportunities: playerCountMetric(step43, playerCount, "opportunities"),
    step43Hits: playerCountMetric(step43, playerCount, "hits"),
  }));
  return {
    generatedAt: new Date().toISOString(),
    target: "S02 deep RAISE-vs-CHECK",
    baseline: {
      step43ExactOpportunities: Number(step43.exactOpportunities ?? 0),
      step43ExactHits: Number(step43.exactHits ?? step43.hitCount ?? 0),
    },
    targetedReference: {
      step42MeanExactOpportunities: roundNumber(step42.metrics?.exactOpportunities?.mean ?? 0, 4),
      step42MeanExactHits: roundNumber(step42.metrics?.exactHits?.mean ?? 0, 4),
      step42MeanExactHitRate: roundNumber(step42.metrics?.exactHitRate?.mean ?? 0, 4),
    },
    exactOpportunities: Number(step45.exactOpportunities ?? 0),
    exactHits: Number(step45.exactHits ?? 0),
    exactHitRate: roundNumber(step45.exactHitRate, 4),
    playerCount3Hits: playerCountMetric(step45, 3, "hits"),
    playerCount4Hits: playerCountMetric(step45, 4, "hits"),
    playerCounts,
    recoveredFromMixedBaseline: Number(step45.exactOpportunities ?? 0) > Number(step43.exactOpportunities ?? 0),
    mixedHitsRecovered: Number(step45.exactHits ?? 0) > 0,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
  };
}

export async function auditExactOpportunityRecovery({
  arenaPath = DEFAULT_STEP45_NATURAL_MIXED_ARENA_PATH,
  step43Path = DEFAULT_STEP43_MIXED_HIT_AUDIT_PATH,
  step42Path = DEFAULT_STEP42_REPEATABILITY_SUMMARY_PATH,
  preexportRowsPath = path.resolve("reports/ai-iron/preexport-s02-deep-raisecheck-step38.jsonl"),
  outputPath = DEFAULT_STEP45_EXACT_RECOVERY_OUTPUT_PATH,
  step45Arena = null,
  step43 = null,
  step42 = null,
  rows = null,
} = {}) {
  const report = summarizeExactOpportunityRecovery({
    step45Arena: step45Arena ?? (await readJson(arenaPath)),
    step43: step43 ?? (await readJson(step43Path)),
    step42: step42 ?? (await readJson(step42Path)),
    rows: rows ?? (await readPreExportRows(preexportRowsPath)),
  });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await auditExactOpportunityRecovery();
  console.log(JSON.stringify(report, null, 2));
}
