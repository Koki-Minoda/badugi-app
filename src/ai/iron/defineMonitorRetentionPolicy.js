import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP25_RETENTION_POLICY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/iron-step25-retention-policy.json",
);

export function defineMonitorRetentionPolicy() {
  return {
    retainCompletedRuns: 50,
    retainFailuresForever: true,
    retainDeterminismFailuresForever: true,
    historyAppendOnly: true,
    outputPath: DEFAULT_STEP25_RETENTION_POLICY_OUTPUT_PATH,
  };
}

export async function writeMonitorRetentionPolicy({
  outputPath = DEFAULT_STEP25_RETENTION_POLICY_OUTPUT_PATH,
} = {}) {
  const report = defineMonitorRetentionPolicy();
  const resolved = { ...report, outputPath };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(resolved, null, 2), "utf8");
  return resolved;
}
