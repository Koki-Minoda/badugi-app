import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STEP15_ARENA_RESULT_PATH = path.resolve("reports/ai-iron/iron-step15-offline-arena-result.json");
export const DEFAULT_STEP15_OPPORTUNITY_OUTPUT_PATH = path.resolve("reports/ai-iron/s02-isolated-opportunity-step15.json");
export const DEFAULT_STEP15_RELAXED_PROPOSAL_OUTPUT_PATH = path.resolve("reports/ai-iron/s02-relaxed-match-proposal-step15.json");
export const STEP15_PARENT_ISOLATED_BUCKET =
  "strongSDA5 CALL/FOLD/RAISE::pc=3way::pos=IP::call=small::repeat=repeated";
const STEP15_ALLOWED_RELAXED_PRESSURE_CHAINS = ["firstRaiseAfterCall", "repeatedPressure"];

function round(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export function buildS02RelaxedMatchProposal() {
  return {
    createdAt: new Date().toISOString(),
    variant: "S02",
    parentIsolatedBucket: STEP15_PARENT_ISOLATED_BUCKET,
    candidates: [
      {
        candidateId: "s02-relaxed-pressure-chain",
        verdict: "PROPOSED",
        sourceType: "verified-relaxed-match",
        relaxedAxes: ["pressureChain"],
        relaxedAxisValues: {
          pressureChain: STEP15_ALLOWED_RELAXED_PRESSURE_CHAINS,
        },
        constraints: {
          playerCountBand: "3way",
          positionBand: "IP",
          toCallBand: "small",
          repeatedPressure: "repeated",
        },
        excluded: ["weak/trash", "lowerMediumSDA5", "medium/large-call", "D01", "multi-axis-relaxation"],
      },
    ],
  };
}

export function analyzeS02IsolatedBucketOpportunityFromArena(arenaReport = {}) {
  const s02Result = (arenaReport.results ?? []).find((entry) => String(entry.variant ?? "").toUpperCase() === "S02") ?? {};
  const sourceTypeAttribution = Array.isArray(s02Result.sourceTypeAttribution) ? s02Result.sourceTypeAttribution : [];
  const fallbackReasonByBucket = s02Result.fallbackReasonByBucket ?? {};
  const targetFallbackReasons = fallbackReasonByBucket[STEP15_PARENT_ISOLATED_BUCKET] ?? {};
  const exactHits = Number(
    sourceTypeAttribution.find((entry) => String(entry.sourceType) === "verified-neighbor-v3-isolated")?.hits ?? 0,
  );
  const relaxedHits = Number(
    sourceTypeAttribution.find((entry) => String(entry.sourceType) === "verified-relaxed-match")?.hits ?? 0,
  );
  const opportunityReasons = {
    NO_MATCHING_STATE: Number(targetFallbackReasons.NO_MATCHING_STATE ?? 0),
    PRESSURE_CHAIN_MISMATCH: Number(targetFallbackReasons.PRESSURE_CHAIN_MISMATCH ?? 0),
    STACK_DEPTH_MISMATCH: Number(targetFallbackReasons.STACK_DEPTH_MISMATCH ?? 0),
    POSITION_MISMATCH: Number(targetFallbackReasons.POSITION_MISMATCH ?? 0),
    PLAYER_COUNT_MISMATCH: Number(targetFallbackReasons.PLAYER_COUNT_MISMATCH ?? 0),
    CALL_BAND_MISMATCH: Number(targetFallbackReasons.CALL_BAND_MISMATCH ?? 0),
    ACTION_ILLEGAL: Number(targetFallbackReasons.ACTION_ILLEGAL ?? 0),
    LEGAL_BUT_NOT_SELECTED: 0,
    BUCKET_MATCHED: exactHits,
  };
  const exactOpportunities = exactHits + opportunityReasons.ACTION_ILLEGAL;
  const nearOpportunities =
    opportunityReasons.PRESSURE_CHAIN_MISMATCH +
    opportunityReasons.STACK_DEPTH_MISMATCH +
    opportunityReasons.POSITION_MISMATCH +
    opportunityReasons.PLAYER_COUNT_MISMATCH +
    opportunityReasons.CALL_BAND_MISMATCH;
  return {
    createdAt: new Date().toISOString(),
    variant: "S02",
    parentIsolatedBucket: STEP15_PARENT_ISOLATED_BUCKET,
    exactHits,
    relaxedHits,
    exactOpportunities,
    nearOpportunities,
    opportunityReasons,
    datasetHitRate: round(s02Result.datasetHitRate, 4),
    proFallbackRate: round(s02Result.proFallbackRate, 4),
  };
}

export async function analyzeS02IsolatedBucketOpportunity({
  arenaResultPath = DEFAULT_STEP15_ARENA_RESULT_PATH,
  outputPath = DEFAULT_STEP15_OPPORTUNITY_OUTPUT_PATH,
  proposalOutputPath = DEFAULT_STEP15_RELAXED_PROPOSAL_OUTPUT_PATH,
} = {}) {
  const arenaReport = await readJson(arenaResultPath);
  const report = analyzeS02IsolatedBucketOpportunityFromArena(arenaReport);
  const proposal = buildS02RelaxedMatchProposal();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(proposalOutputPath, JSON.stringify(proposal, null, 2), "utf8");
  return {
    outputPath,
    proposalOutputPath,
    report,
    proposal,
  };
}
