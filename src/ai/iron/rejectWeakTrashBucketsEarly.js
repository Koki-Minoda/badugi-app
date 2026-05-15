import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP31_WEAK_TRASH_REJECTION_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/weak-trash-rejection-step31.json",
);
export const DEFAULT_STEP30_RANKING_INPUT_PATH = path.resolve(
  "reports/ai-iron/coverage-expansion-ranking-step30.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function rejectionReasons(entry = {}) {
  const text = `${entry.variant ?? entry.variantId ?? ""} ${entry.bucketFamily ?? entry.bucket ?? ""} ${entry.handClass ?? ""}`.toLowerCase();
  const reasons = [];
  if (text.includes("d01")) reasons.push("D01-excluded");
  if (text.includes("trash")) reasons.push("trash-bucket");
  if (text.includes("weak")) reasons.push("weak-bucket");
  if (Number(entry.entropyScore ?? 0) > 0.7 || ["HIGH_ENTROPY", "UNEXPORTABLE"].includes(String(entry.entropyClassification ?? ""))) {
    reasons.push("high-entropy");
  }
  if (Number(entry.repairRate ?? 0) > 0.1) reasons.push("high-repair");
  if (Number(entry.signFlipRate ?? 0) > 0.2) reasons.push("high-signFlip");
  if (entry.priority === "P3_MONITOR_ONLY" || entry.status === "COUNTERFACTUAL_ONLY") reasons.push("monitor-only");
  if (entry.priority === "DO_NOT_TOUCH" && !reasons.length) reasons.push("do-not-touch");
  if (entry.fallbackOnly === true || String(entry.risk ?? "").includes("fallback-only")) reasons.push("fallback-only");
  return reasons;
}

export function rejectWeakTrashBucketsEarly({ candidates = [] } = {}) {
  const rejected = [];
  const accepted = [];
  candidates.forEach((entry) => {
    const reasons = rejectionReasons(entry);
    const normalized = {
      candidate: `${entry.variant ?? entry.variantId ?? "unknown"} ${entry.bucketFamily ?? entry.bucket ?? "unknown"}`,
      variant: entry.variant ?? entry.variantId ?? null,
      bucket: entry.bucketFamily ?? entry.bucket ?? null,
      priority: entry.priority ?? null,
    };
    if (reasons.length) rejected.push({ ...normalized, rejectReason: reasons });
    else accepted.push(normalized);
  });
  return {
    generatedAt: new Date().toISOString(),
    rejected,
    accepted,
    rejectedCount: rejected.length,
    acceptedCount: accepted.length,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP31_WEAK_TRASH_REJECTION_OUTPUT_PATH,
  };
}

export async function writeWeakTrashRejection({
  inputPath = DEFAULT_STEP30_RANKING_INPUT_PATH,
  outputPath = DEFAULT_STEP31_WEAK_TRASH_REJECTION_OUTPUT_PATH,
  candidates,
} = {}) {
  const report = candidates ? { ranking: candidates } : await readJsonIfExists(inputPath);
  return writeJsonReport(outputPath, rejectWeakTrashBucketsEarly({ candidates: report?.ranking ?? [] }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeWeakTrashRejection();
  console.log(JSON.stringify(report, null, 2));
}
