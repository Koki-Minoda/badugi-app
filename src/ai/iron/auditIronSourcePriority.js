import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP20_PRIORITY_AUDIT_PATH = path.resolve(
  "reports/ai-iron/s02-source-priority-audit-step20.json",
);

export async function writeIronSourcePriorityAudit({
  rows = [],
  outputPath = DEFAULT_STEP20_PRIORITY_AUDIT_PATH,
} = {}) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(rows, null, 2), "utf8");
  return rows;
}
