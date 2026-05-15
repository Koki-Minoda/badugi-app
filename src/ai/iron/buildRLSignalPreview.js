import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP46_RL_SIGNAL_PREVIEW_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step46-rl-signal-preview.json",
);

export function classifyRLSignalCandidate(candidate = {}) {
  if (candidate.legal !== true || candidate.deterministic !== true || candidate.replayAvailable !== true) return "REJECT";
  if (Number(candidate.exactHits ?? 0) <= 0 || Number(candidate.estimatedEVGain ?? 0) <= 0) return "MONITOR_ONLY";
  if (Number(candidate.exactHits ?? 0) >= 5 && Number(candidate.estimatedEVGain ?? 0) >= 20) {
    return "READY_FOR_SUPERVISED_SIGNAL";
  }
  return "READY_FOR_COACHING_ONLY";
}

function countByCategory(candidates = []) {
  const categories = {
    READY_FOR_SUPERVISED_SIGNAL: 0,
    READY_FOR_COACHING_ONLY: 0,
    MONITOR_ONLY: 0,
    REJECT: 0,
  };
  for (const candidate of candidates) {
    categories[classifyRLSignalCandidate(candidate)] += 1;
  }
  return categories;
}

export async function readJsonl(filePath) {
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function buildRLSignalPreviewSummary({ candidates = [] } = {}) {
  const rows = candidates.map((candidate) => ({
    ...candidate,
    category: classifyRLSignalCandidate(candidate),
  }));
  return {
    generatedAt: new Date().toISOString(),
    source: "step46-coaching-material-candidates",
    trainingDatasetMutation: false,
    categories: countByCategory(candidates),
    rows,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    modelRegistryMutation: false,
  };
}

export async function buildRLSignalPreview({
  candidatesPath = path.resolve("reports/ai-iron/step46-coaching-material-candidates.jsonl"),
  outputPath = DEFAULT_STEP46_RL_SIGNAL_PREVIEW_OUTPUT_PATH,
  candidates = null,
} = {}) {
  const report = buildRLSignalPreviewSummary({ candidates: candidates ?? (await readJsonl(candidatesPath)) });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildRLSignalPreview();
  console.log(JSON.stringify(report, null, 2));
}
