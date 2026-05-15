import fs from "node:fs/promises";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP31_FUTURE_QUEUE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/future-candidate-queue-step31.json",
);
export const DEFAULT_STEP31_ENTROPY_INPUT_PATH = path.resolve(
  "reports/ai-iron/entropy-aware-candidates-step31.json",
);
export const DEFAULT_STEP31_RARITY_INPUT_PATH = path.resolve(
  "reports/ai-iron/candidate-rarity-step31.json",
);
export const DEFAULT_STEP31_REJECTION_INPUT_PATH = path.resolve(
  "reports/ai-iron/weak-trash-rejection-step31.json",
);

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function queueStatus({ entropyCandidate, rarity, rejected }) {
  if (rejected?.rejectReason?.includes("monitor-only")) return "MONITOR_ONLY";
  if (rejected) return "DO_NOT_TOUCH";
  if (rarity?.classification === "TOO_RARE") return "TOO_RARE";
  if (entropyCandidate?.classification === "SAFE_CANDIDATE" && rarity?.classification === "VIABLE") return "SAFE_NEXT";
  if (entropyCandidate?.classification === "COUNTERFACTUAL_ONLY" && rarity?.classification !== "TOO_RARE") {
    return "COUNTERFACTUAL_FIRST";
  }
  if (entropyCandidate?.classification === "MONITOR_ONLY" || rarity?.classification === "SHADOW_ONLY") return "MONITOR_ONLY";
  return "DO_NOT_TOUCH";
}

export function buildFutureCandidateQueue({ entropyCandidates = [], rarityCandidates = [], rejected = [] } = {}) {
  const rarityByCandidate = new Map(rarityCandidates.map((entry) => [entry.candidate, entry]));
  const rejectedByCandidate = new Map(rejected.map((entry) => [entry.candidate, entry]));
  const queue = entropyCandidates.map((entry) => {
    const rarity = rarityByCandidate.get(entry.candidate);
    const rejection = rejectedByCandidate.get(entry.candidate);
    const status = queueStatus({ entropyCandidate: entry, rarity, rejected: rejection });
    return {
      candidate: entry.candidate,
      variant: entry.variant,
      bucket: entry.bucket,
      status,
      reason:
        rejection?.rejectReason?.join(", ") ??
        entry.reason?.join(", ") ??
        rarity?.classification ??
        "no stable signal",
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    queue,
    safeNext: queue.filter((entry) => entry.status === "SAFE_NEXT"),
    counterfactualFirst: queue.filter((entry) => entry.status === "COUNTERFACTUAL_FIRST"),
    monitorOnly: queue.filter((entry) => entry.status === "MONITOR_ONLY"),
    doNotTouch: queue.filter((entry) => entry.status === "DO_NOT_TOUCH"),
    tooRare: queue.filter((entry) => entry.status === "TOO_RARE"),
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP31_FUTURE_QUEUE_OUTPUT_PATH,
  };
}

export async function writeFutureCandidateQueue({
  entropyPath = DEFAULT_STEP31_ENTROPY_INPUT_PATH,
  rarityPath = DEFAULT_STEP31_RARITY_INPUT_PATH,
  rejectionPath = DEFAULT_STEP31_REJECTION_INPUT_PATH,
  outputPath = DEFAULT_STEP31_FUTURE_QUEUE_OUTPUT_PATH,
  entropyCandidates,
  rarityCandidates,
  rejected,
} = {}) {
  const entropyReport = entropyCandidates ? { candidates: entropyCandidates } : await readJsonIfExists(entropyPath);
  const rarityReport = rarityCandidates ? { candidates: rarityCandidates } : await readJsonIfExists(rarityPath);
  const rejectionReport = rejected ? { rejected } : await readJsonIfExists(rejectionPath);
  return writeJsonReport(
    outputPath,
    buildFutureCandidateQueue({
      entropyCandidates: entropyReport?.candidates ?? [],
      rarityCandidates: rarityReport?.candidates ?? [],
      rejected: rejectionReport?.rejected ?? [],
    }),
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeFutureCandidateQueue();
  console.log(JSON.stringify(report, null, 2));
}
