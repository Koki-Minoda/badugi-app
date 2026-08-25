#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runBadugiValueBetAudit } from "../src/ai/qa/badugiValuePressureAudit.js";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function round(value, digits = 4) {
  return Math.round((Number(value) || 0) * 10 ** digits) / 10 ** digits;
}

function compactComparison(comparison = []) {
  return comparison.map((row) => ({
    pathId: row.pathId,
    decisions: row.decisions,
    vpip: round(row.vpip),
    pfr: round(row.pfr),
    foldRate: round(row.foldRate),
    aggressionFrequency: round(row.aggressionFrequency),
    valueBetOpportunities: row.valueBetOpportunities,
    valueBetFrequency: round(row.valueBetFrequency),
    headsUpPressureOpportunities: row.headsUpPressureOpportunities,
    headsUpPressureFrequency: round(row.headsUpPressureFrequency),
    meaningfulDecisionDensity: round(row.meaningfulDecisionDensity),
    adapterMismatches: row.adapterMismatches,
    classifications: row.classifications,
  }));
}

export function runBadugiValueBetAuditCli({ outDir = "reports/ai" } = {}) {
  const report = runBadugiValueBetAudit();
  const comparisonReport = {
    generatedAt: report.generatedAt,
    scope: report.scope,
    comparison: compactComparison(report.comparison),
    classification:
      report.comparison.find((row) => row.pathId === "pro-overlay")?.valueBetFrequency === 0
        ? "PASSIVE_BEHAVIOR_CONFIRMED_IN_PRO_OVERLAY_RUNTIME_ADAPTER"
        : "NO_GLOBAL_PASSIVE_COLLAPSE_IN_AUDIT_SCENARIOS",
  };

  ensureDir(outDir);
  const auditPath = path.join(outDir, "badugi-value-bet-audit.json");
  const comparisonPath = path.join(outDir, "badugi-cpu-pressure-comparison.json");
  fs.writeFileSync(auditPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(comparisonPath, `${JSON.stringify(comparisonReport, null, 2)}\n`);

  return {
    auditPath,
    comparisonPath,
    report,
    comparisonReport,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outArg = process.argv.find((arg) => arg.startsWith("--outDir="));
  const outDir = outArg ? outArg.slice("--outDir=".length) : "reports/ai";
  const result = runBadugiValueBetAuditCli({ outDir });
  console.log(
    JSON.stringify(
      {
        auditPath: result.auditPath,
        comparisonPath: result.comparisonPath,
        comparison: result.comparisonReport.comparison,
        classification: result.comparisonReport.classification,
      },
      null,
      2,
    ),
  );
}
