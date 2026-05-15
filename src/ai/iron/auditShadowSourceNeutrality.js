import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP21_NEUTRALITY_AUDIT_PATH = path.resolve(
  "reports/ai-iron/s02-shadow-neutrality-step21.json",
);

export async function auditShadowSourceNeutrality({
  auditRows = [],
  outputPath = DEFAULT_STEP21_NEUTRALITY_AUDIT_PATH,
} = {}) {
  const rows = (Array.isArray(auditRows) ? auditRows : []).map((row, index) => ({
    decisionId: row.decisionId ?? `shadow-neutrality-${index + 1}`,
    selectedSource: row.selectedSource ?? null,
    shadowSource: row.shadowSelectedSource ?? null,
    selectedAction: row.selectedAction ?? "RAISE",
    shadowAction: row.shadowAction ?? "RAISE",
    sameAction: Boolean(row.sameAction),
    selectedEVEstimate: Number(row.selectedEVEstimate ?? 0),
    shadowEVEstimate: Number(row.shadowEVEstimate ?? 0),
    evDelta: Number((Number(row.selectedEVEstimate ?? 0) - Number(row.shadowEVEstimate ?? 0)).toFixed(4)),
    specificityDelta: Number(row.sourceSpecificityDelta ?? 0),
  }));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(rows, null, 2), "utf8");
  return rows;
}
