import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP21_NEUTRALITY_SUMMARY_PATH = path.resolve(
  "reports/ai-iron/s02-shadow-neutrality-summary-step21.json",
);

export async function aggregateShadowNeutrality({
  rows = [],
  outputPath = DEFAULT_STEP21_NEUTRALITY_SUMMARY_PATH,
} = {}) {
  const entries = Array.isArray(rows) ? rows : [];
  const exactOpportunities = entries.length;
  const sameActionCount = entries.filter((entry) => entry.sameAction).length;
  const differentActionCount = entries.filter((entry) => !entry.sameAction).length;
  const meanEVDelta = exactOpportunities
    ? Number((entries.reduce((sum, entry) => sum + Number(entry.evDelta ?? 0), 0) / exactOpportunities).toFixed(4))
    : 0;
  const maxEVDelta = exactOpportunities
    ? Number(Math.max(...entries.map((entry) => Math.abs(Number(entry.evDelta ?? 0)))).toFixed(4))
    : 0;
  const specificityMeanDelta = exactOpportunities
    ? Number((entries.reduce((sum, entry) => sum + Number(entry.specificityDelta ?? 0), 0) / exactOpportunities).toFixed(4))
    : 0;
  const summary = {
    exactOpportunities,
    sameActionCount,
    differentActionCount,
    sameActionRate: exactOpportunities ? Number((sameActionCount / exactOpportunities).toFixed(4)) : 0,
    differentActionRate: exactOpportunities ? Number((differentActionCount / exactOpportunities).toFixed(4)) : 0,
    meanEVDelta,
    maxEVDelta,
    specificityMeanDelta,
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), "utf8");
  return summary;
}
