import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP20_SHADOW_COMPARISON_PATH = path.resolve(
  "reports/ai-iron/s02-shadow-source-comparison-step20.json",
);

export async function analyzeShadowSourceComparison({
  auditRows = [],
  outputPath = DEFAULT_STEP20_SHADOW_COMPARISON_PATH,
} = {}) {
  const rows = Array.isArray(auditRows) ? auditRows : [];
  const summary = {
    exactOpportunities: rows.length,
    selectedSourceCounts: {},
    shadowSourceCounts: {},
    sameActionCount: 0,
    differentActionCount: 0,
    averageSpecificityDelta: 0,
  };
  let totalDelta = 0;
  for (const row of rows) {
    const selected = String(row?.selectedSource ?? "");
    const shadow = String(row?.shadowSelectedSource ?? "");
    if (selected) summary.selectedSourceCounts[selected] = (summary.selectedSourceCounts[selected] ?? 0) + 1;
    if (shadow) summary.shadowSourceCounts[shadow] = (summary.shadowSourceCounts[shadow] ?? 0) + 1;
    if (row?.sameAction) summary.sameActionCount += 1;
    if (row?.differentAction) summary.differentActionCount += 1;
    totalDelta += Number(row?.sourceSpecificityDelta ?? 0);
  }
  summary.averageSpecificityDelta = rows.length ? Number((totalDelta / rows.length).toFixed(4)) : 0;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), "utf8");
  return summary;
}
