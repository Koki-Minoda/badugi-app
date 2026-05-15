import path from "node:path";

import {
  candidatePriority,
  isDoNotTouchBucket,
  loadStep27Evidence,
  roundNumber,
  writeJsonReport,
} from "./coverageAuditUtils.js";
import { mineIronFallbackHotspots } from "./mineIronFallbackHotspots.js";
import { mineMediumEVLeaks } from "./mineMediumEVLeaks.js";

export const DEFAULT_STEP27_EXPANSION_RANKING_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/coverage-expansion-ranking-step27.json",
);

function candidateKey(entry = {}) {
  return `${entry.variant}|${entry.bucket}`;
}

function scoreCandidate(entry = {}) {
  if (isDoNotTouchBucket(entry)) return 0;
  const frequencyWeight = Math.min(1, Number(entry.frequency ?? entry.sampleCount ?? 0) / 120);
  const mediumEVLeakWeight = Math.min(1, Math.abs(Number(entry.meanDelta ?? entry.standardAdvantage ?? 0)) / 80);
  const confidenceWeight = Number(entry.confidence ?? 0.7);
  const legalityCleanWeight = Number(entry.illegal ?? 0) === 0 ? 1 : 0.5;
  const replayVerifiableWeight = Number(entry.frequency ?? entry.sampleCount ?? 0) > 0 ? 1 : 0.5;
  const notDoNotTouchWeight = 1;
  return roundNumber(
    frequencyWeight *
      mediumEVLeakWeight *
      confidenceWeight *
      legalityCleanWeight *
      replayVerifiableWeight *
      notDoNotTouchWeight,
    4,
  );
}

export function rankCoverageExpansionCandidates({
  arenaSummary = [],
  divergenceRows = [],
  fallbackHotspots = null,
  mediumEVLeaks = null,
  topN = 20,
} = {}) {
  const hotspots = fallbackHotspots ?? mineIronFallbackHotspots({ arenaSummary, divergenceRows, topN: 50 }).hotspots;
  const leaks = mediumEVLeaks ?? mineMediumEVLeaks({ arenaSummary, divergenceRows, topN: 50 }).candidates;
  const merged = new Map();
  [
    ...hotspots.map((entry) => ({ ...entry, evidenceType: "fallback hotspot" })),
    ...leaks.map((entry) => ({ ...entry, evidenceType: "medium EV leak" })),
  ].forEach((entry) => {
    const key = candidateKey(entry);
    const existing = merged.get(key) ?? {};
    merged.set(key, {
      ...existing,
      ...entry,
      evidence: [existing.evidence, entry.evidenceType]
        .flat()
        .filter(Boolean),
    });
  });

  const ranking = [...merged.values()]
    .map((entry) => {
      const score = scoreCandidate(entry);
      const priority = score === 0 ? "DO_NOT_TOUCH" : candidatePriority(entry.classification);
      return {
        priority,
        variant: entry.variant,
        bucketFamily: entry.bucket,
        score,
        nextAction:
          priority === "P1_EXPAND_NEXT"
            ? "prepare counterfactual-backed dataset expansion proposal"
            : priority === "P2_COUNTERFACTUAL_FIRST"
              ? "run focused counterfactual replay before dataset expansion"
              : priority === "DO_NOT_TOUCH"
                ? "do not expand; monitor only"
                : "monitor only",
        evidence: Array.from(new Set(entry.evidence ?? [])),
        risk: priority === "DO_NOT_TOUCH" ? "high/noisy" : priority === "P2_COUNTERFACTUAL_FIRST" ? "medium" : "low-medium",
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, topN);

  return {
    generatedAt: new Date().toISOString(),
    scoring: {
      formula:
        "frequencyWeight * mediumEVLeakWeight * confidenceWeight * legalityCleanWeight * replayVerifiableWeight * notDoNotTouchWeight",
    },
    ranking,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    outputPath: DEFAULT_STEP27_EXPANSION_RANKING_OUTPUT_PATH,
  };
}

export async function writeCoverageExpansionCandidateRanking({
  outputPath = DEFAULT_STEP27_EXPANSION_RANKING_OUTPUT_PATH,
  ...input
} = {}) {
  const evidence = input.arenaSummary || input.divergenceRows ? input : await loadStep27Evidence();
  const report = rankCoverageExpansionCandidates(evidence);
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeCoverageExpansionCandidateRanking();
  console.log(JSON.stringify(report, null, 2));
}
