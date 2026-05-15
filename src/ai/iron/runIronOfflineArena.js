import fs from "node:fs/promises";
import path from "node:path";

import { getActorIndex } from "../../games/testing/progress/gameProgressInvariants.js";
import {
  buildActionPayload,
  clone,
  createControllerForVariant,
  decideAction,
  getCurrentBet,
  isEvaluationTerminal,
} from "../evaluation/runAiEvaluationBatch.js";
import { checkIronDryRunEligibility } from "./checkIronDryRunEligibility.js";
import { createIronCandidatePolicy, STEP41_S02_DEEP_RAISE_CHECK_TARGET } from "./ironCandidatePolicy.js";
import { analyzeIronDatasetHits } from "./analyzeIronDatasetHits.js";
import {
  DEFAULT_STEP16_NEAR_MISS_OUTPUT_PATH,
  DEFAULT_STEP16_OPPORTUNITY_OUTPUT_PATH,
  DEFAULT_STEP17_OPPORTUNITY_OUTPUT_PATH,
  DEFAULT_STEP17_NEAR_MISS_OUTPUT_PATH,
  DEFAULT_STEP17_PLAYERCOUNT_OUTPUT_PATH,
  STEP16_TARGET_BUCKET,
  classifyS02RelaxedOpportunityDecision,
  summarizeS02RelaxedOpportunityProfiles,
  writeS02PlayerCountOpportunityProfile,
  writeS02RelaxedOpportunityArtifacts,
} from "./profileS02RelaxedOpportunity.js";
import { DEFAULT_STEP18_DECISION_TIMING_TRACE_PATH, writeArenaDecisionTimingTrace } from "./traceArenaDecisionTiming.js";

const DEFAULT_DATASET_PATH = path.resolve("data/ai/action-value/iron-step7-action-value.jsonl");
const DEFAULT_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-step9-offline-arena-result.json");
const DEFAULT_STABILITY_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-step9-offline-arena-stability.json");
const DEFAULT_DRYRUN_GATE_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-step9-dryrun-gate.json");
const DEFAULT_TARGETED_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-step16-s02-targeted-arena.json");
const DEFAULT_TARGETED_STABILITY_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-step16-s02-targeted-arena-stability.json");
const DEFAULT_STEP17_TARGETED_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-step17-s02-targeted-arena.json");
const DEFAULT_STEP17_TARGETED_STABILITY_OUTPUT_PATH = path.resolve("reports/ai-iron/iron-step17-s02-targeted-arena-stability.json");

function deriveArenaTagFromDatasetPath(datasetPath = "") {
  const base = path.basename(String(datasetPath ?? ""));
  const match = base.match(/(iron-step\d+)-action-value\.jsonl$/i);
  if (match) return match[1].toLowerCase();
  return "iron-step9";
}

function defaultArenaPath(fileType = "result", datasetPath = DEFAULT_DATASET_PATH) {
  const tag = deriveArenaTagFromDatasetPath(datasetPath);
  switch (fileType) {
    case "stability":
      return path.resolve(`reports/ai-iron/${tag}-offline-arena-stability.json`);
    case "dryrun-gate":
      return path.resolve(`reports/ai-iron/${tag}-dryrun-gate.json`);
    default:
      return path.resolve(`reports/ai-iron/${tag}-offline-arena-result.json`);
  }
}

function defaultTargetedArenaPath(fileType = "result") {
  switch (fileType) {
    case "stability":
      return DEFAULT_TARGETED_STABILITY_OUTPUT_PATH;
    case "dryrun-gate":
      return path.resolve("reports/ai-iron/iron-step16-s02-targeted-dryrun-gate.json");
    default:
      return DEFAULT_TARGETED_OUTPUT_PATH;
  }
}

function defaultStep17TargetedArenaPath(fileType = "result") {
  switch (fileType) {
    case "stability":
      return DEFAULT_STEP17_TARGETED_STABILITY_OUTPUT_PATH;
    case "dryrun-gate":
      return path.resolve("reports/ai-iron/iron-step17-s02-targeted-dryrun-gate.json");
    default:
      return DEFAULT_STEP17_TARGETED_OUTPUT_PATH;
  }
}

function defaultStep41TargetedArenaPath(fileType = "result") {
  switch (fileType) {
    case "stability":
      return path.resolve("reports/ai-iron/iron-step41-targeted-smoke-arena-stability.json");
    case "dryrun-gate":
      return path.resolve("reports/ai-iron/iron-step41-targeted-dryrun-gate.json");
    default:
      return path.resolve("reports/ai-iron/iron-step41-targeted-smoke-arena.json");
  }
}

function defaultStep45NaturalMixedArenaPath(fileType = "result") {
  switch (fileType) {
    case "stability":
      return path.resolve("reports/ai-iron/iron-step45-natural-mixed-arena-stability.json");
    case "dryrun-gate":
      return path.resolve("reports/ai-iron/iron-step45-natural-mixed-arena-dryrun-gate.json");
    default:
      return path.resolve("reports/ai-iron/iron-step45-natural-mixed-arena.json");
  }
}

function parseArgs(argv = []) {
  const options = {};
  argv.forEach((argument) => {
    if (!argument.startsWith("--")) return;
    const [rawKey, rawValue = "true"] = argument.slice(2).split("=");
    options[rawKey] = rawValue;
  });
  return {
    datasetPath: path.resolve(String(options.dataset ?? DEFAULT_DATASET_PATH)),
    variants:
      typeof options.variants === "string" && options.variants.trim().length
        ? options.variants.split(",").map((entry) => entry.trim().toUpperCase()).filter(Boolean)
        : ["D02", "S01", "S02"],
    hands: Number(options.hands ?? 300),
    seeds:
      typeof options.seeds === "string" && options.seeds.trim().length
        ? options.seeds.split(",").map((entry) => Number(entry.trim())).filter(Number.isFinite)
        : [20260524, 20260525, 20260526],
    outputPath:
      typeof options.output === "string" && options.output.trim().length
        ? path.resolve(String(options.output))
        : null,
    stabilityOutputPath:
      typeof options["stability-output"] === "string" && options["stability-output"].trim().length
        ? path.resolve(String(options["stability-output"]))
        : null,
    dryRunGateOutputPath:
      typeof options["dryrun-gate-output"] === "string" && options["dryrun-gate-output"].trim().length
        ? path.resolve(String(options["dryrun-gate-output"]))
        : null,
    targetBucket:
      typeof options["target-bucket"] === "string" && options["target-bucket"].trim().length
        ? String(options["target-bucket"]).trim()
        : null,
    targetedSampling: String(options["targeted-sampling"] ?? "false") === "true",
    targetMinOpportunities: Number(options["target-min-opportunities"] ?? 20),
    targetPlayerCount: Number(options["target-player-count"] ?? 0),
    targetHandclass:
      typeof options["target-handclass"] === "string" && options["target-handclass"].trim().length
        ? String(options["target-handclass"]).trim()
        : null,
    targetPosition:
      typeof options["target-position"] === "string" && options["target-position"].trim().length
        ? String(options["target-position"]).trim()
        : null,
    targetCallBand:
      typeof options["target-call-band"] === "string" && options["target-call-band"].trim().length
        ? String(options["target-call-band"]).trim()
        : null,
    targetPressureChain:
      typeof options["target-pressure-chain"] === "string" && options["target-pressure-chain"].trim().length
        ? options["target-pressure-chain"].split(",").map((entry) => entry.trim()).filter(Boolean)
        : [],
    targetMinExactOpportunities: Number(options["target-min-exact-opportunities"] ?? 0),
    maxHands: Number(options["max-hands"] ?? 0),
    maxDecisions: Number(options["max-decisions"] ?? 0),
    replayCompatiblePlayercount: String(options["replay-compatible-playercount"] ?? "false") === "true",
    replayCompatibleCallband: String(options["replay-compatible-callband"] ?? "false") === "true",
    replayCompatiblePressurechain: String(options["replay-compatible-pressurechain"] ?? "false") === "true",
    shadowSourceAttribution: String(options["shadow-source-attribution"] ?? "false") === "true",
    naturalMixedExposure: String(options["natural-mixed-exposure"] ?? "false") === "true",
  };
}

function createSeededRandom(seed = 1) {
  let value = Math.max(1, Math.floor(seed) % 2147483647);
  return () => {
    value = (value * 48271) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

async function withSeededRandom(seed, callback) {
  const previousRandom = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return await callback();
  } finally {
    Math.random = previousRandom;
  }
}

function createCpuSeatConfig(playerCount) {
  return Array.from({ length: playerCount }, () => "CPU");
}

function createInitialHandState(controller, variantId, playerCount = 6) {
  const seatConfig = createCpuSeatConfig(playerCount);
  const initial = controller.createInitialState();
  if (variantId === "D03") {
    return controller.createNewHandState(initial, {
      seatConfig,
      startingStack: 500,
      blindStructure: [{ sb: 5, bb: 10, ante: 0 }],
    });
  }
  return controller.createNewHandState(initial, {
    seatConfig,
    startingStack: 500,
    structure: { sb: 10, bb: 20, ante: 0 },
  });
}

export function naturalMixedExposurePlayerCount(handIndex = 0, seedIndex = 0) {
  const schedule = [6, 6, 4, 3];
  const index = Math.abs(Number(handIndex ?? 0) + Number(seedIndex ?? 0)) % schedule.length;
  return schedule[index];
}

export function summarizeTableSizeDistribution(counts = {}) {
  const normalized = {
    "6max": Number(counts["6max"] ?? 0),
    "4max": Number(counts["4max"] ?? 0),
    "3way": Number(counts["3way"] ?? 0),
  };
  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(
    Object.entries(normalized).map(([key, value]) => [key, roundNumber(value / Math.max(1, total), 4)]),
  );
}

function countLivePlayers(snapshot = {}) {
  return (snapshot?.players ?? []).filter(
    (player) =>
      player &&
      !player.folded &&
      !player.hasFolded &&
      !player.seatOut &&
      !player.sittingOut &&
      !player.busted &&
      !player.isBusted,
  ).length;
}

function getFinalPot(snapshot = {}) {
  if (typeof snapshot?.pot === "number") return snapshot.pot;
  if (Array.isArray(snapshot?.pots)) {
    return snapshot.pots.reduce((sum, pot) => sum + Math.max(0, Number(pot?.amount ?? pot?.potAmount ?? 0)), 0);
  }
  return 0;
}

async function playArenaHand({
  variantId,
  seed,
  sourceSeed = seed,
  handIndex,
  evaluatedSeat,
  evaluatedPolicy,
  candidatePolicy = null,
  targetBucket = null,
  opportunityProfiles = null,
  replayCompatiblePlayercount = false,
  replayCompatibleCallband = false,
  replayCompatiblePressurechain = false,
  playerCount = 6,
  maxSteps = 300,
}) {
  return withSeededRandom(seed, async () => {
    const controller = createControllerForVariant(variantId, playerCount);
    let state = createInitialHandState(controller, variantId, playerCount);
    const beforeSnapshot = clone(state?.snapshot ?? controller.getUiSnapshot(state));
    const metrics = {
      actions: 0,
      illegal: 0,
      freeze: false,
      datasetHits: 0,
      proFallbacks: 0,
      bucketHitDistribution: {},
      sourceTypeHitDistribution: {},
      candidateBucketObservations: {},
      fallbackReasonDistribution: {},
      fallbackReasonByBucket: {},
    };

    for (let step = 0; step < maxSteps; step += 1) {
      const snapshot = state?.snapshot ?? controller.getUiSnapshot(state);
      const actor = getActorIndex(snapshot);
      if (isEvaluationTerminal(controller, state, snapshot)) {
        const seatDelta =
          Number(snapshot?.players?.[evaluatedSeat]?.stack ?? 0) -
          Number(beforeSnapshot?.players?.[evaluatedSeat]?.stack ?? 0);
        return {
          ok: true,
          seed,
          sourceSeed,
          seatDelta,
          finalPot: getFinalPot(snapshot),
          metrics,
        };
      }
      if (!Number.isInteger(actor)) {
        if (countLivePlayers(snapshot) <= 1) {
          const seatDelta =
            Number(snapshot?.players?.[evaluatedSeat]?.stack ?? 0) -
            Number(beforeSnapshot?.players?.[evaluatedSeat]?.stack ?? 0);
          return { ok: true, seed, sourceSeed, seatDelta, finalPot: getFinalPot(snapshot), metrics };
        }
        return { ok: false, seed, sourceSeed, reason: "missing-actor", metrics: { ...metrics, freeze: true } };
      }

      const legalActions = controller.getLegalActions(state, actor);
      let decision = null;
      if (actor === evaluatedSeat) {
        if (evaluatedPolicy === "iron") {
          decision = await candidatePolicy.chooseAction({
            variantId,
            snapshot,
            seatIndex: actor,
            legalActions,
            fallbackDecisionFactory: async () =>
              decideAction({
                controller,
                variantId,
                state,
                seatIndex: actor,
                tierId: "pro",
              }),
          });
          metrics.actions += 1;
          if (decision?.metadata?.ironDryRunMatched) {
            metrics.datasetHits += 1;
            const bucket = String(decision?.metadata?.matchedBucket ?? "");
            metrics.bucketHitDistribution[bucket] = (metrics.bucketHitDistribution[bucket] ?? 0) + 1;
            const candidateBucket = String(decision?.metadata?.candidateBucket ?? bucket);
            if (candidateBucket) {
              metrics.candidateBucketObservations[candidateBucket] =
                (metrics.candidateBucketObservations[candidateBucket] ?? 0) + 1;
            }
            const sourceType = String(decision?.metadata?.matchedSourceType ?? "stable-bucket");
            metrics.sourceTypeHitDistribution[sourceType] = (metrics.sourceTypeHitDistribution[sourceType] ?? 0) + 1;
          } else if (decision?.metadata?.ironDryRunFallback) {
            metrics.proFallbacks += 1;
            const candidateBucket = String(decision?.metadata?.candidateBucket ?? "");
            const fallbackReason = String(decision?.metadata?.ironDryRunFallbackReason ?? "unknown");
            if (candidateBucket) {
              metrics.candidateBucketObservations[candidateBucket] =
                (metrics.candidateBucketObservations[candidateBucket] ?? 0) + 1;
              if (!metrics.fallbackReasonByBucket[candidateBucket]) metrics.fallbackReasonByBucket[candidateBucket] = {};
              metrics.fallbackReasonByBucket[candidateBucket][fallbackReason] =
                (metrics.fallbackReasonByBucket[candidateBucket][fallbackReason] ?? 0) + 1;
            }
            metrics.fallbackReasonDistribution[fallbackReason] =
              (metrics.fallbackReasonDistribution[fallbackReason] ?? 0) + 1;
          }
          if (
            targetBucket === STEP16_TARGET_BUCKET &&
            variantId === "S02" &&
            Array.isArray(opportunityProfiles)
          ) {
            const profile = classifyS02RelaxedOpportunityDecision({
              variantId,
              snapshot,
              seatIndex: actor,
              legalActions,
              decisionMetadata: decision?.metadata ?? {},
              specializedRows: candidatePolicy?.specializedRows ?? [],
              selectedAction: decision,
              replayCompatibleMode: replayCompatiblePlayercount,
              replayCompatibleCallband,
              replayCompatiblePressurechain,
            });
            if (profile) opportunityProfiles.push(profile);
          }
        } else {
          decision = decideAction({
            controller,
            variantId,
            state,
            seatIndex: actor,
            tierId: evaluatedPolicy,
          });
        }
      } else {
        decision = decideAction({
          controller,
          variantId,
          state,
          seatIndex: actor,
          tierId: "standard",
        });
      }

      const actionPayload = buildActionPayload({
        seatIndex: actor,
        decision,
        tierId: actor === evaluatedSeat && evaluatedPolicy !== "iron" ? evaluatedPolicy : actor === evaluatedSeat ? "pro" : "standard",
        currentBetAmount: getCurrentBet(snapshot, actor),
      });
      const result = controller.applyAction(state, actionPayload);
      const invalidEvent = result?.events?.find((event) => ["invalidAction", "error"].includes(String(event?.type ?? "")));
      if (invalidEvent) {
        return {
          ok: false,
          seed,
          sourceSeed,
          reason: invalidEvent?.error ?? "invalid-action",
          metrics: { ...metrics, illegal: metrics.illegal + 1 },
        };
      }
      state = result.state;
    }

    return { ok: false, seed, sourceSeed, reason: "max-steps-exceeded", metrics: { ...metrics, freeze: true } };
  });
}

function roundNumber(value, digits = 2) {
  return Number(Number(value ?? 0).toFixed(digits));
}

function summarizeSeedRuns(runs = []) {
  const completed = runs.filter((run) => run.ok);
  const ev = completed.reduce((sum, run) => sum + Number(run.seatDelta ?? 0), 0) / Math.max(1, completed.length);
  const datasetHits = completed.reduce((sum, run) => sum + Number(run.metrics?.datasetHits ?? 0), 0);
  const actions = completed.reduce((sum, run) => sum + Number(run.metrics?.actions ?? 0), 0);
  const proFallbacks = completed.reduce((sum, run) => sum + Number(run.metrics?.proFallbacks ?? 0), 0);
  return {
    hands: runs.length,
    completedHands: completed.length,
    evPerHand: roundNumber(ev, 2),
    illegal: runs.filter((run) => !run.ok && String(run.reason).includes("invalid")).length,
    freeze: runs.filter((run) => (!run.ok && String(run.reason).includes("max-steps")) || run.metrics?.freeze).length,
    datasetHitRate: roundNumber(datasetHits / Math.max(1, actions), 4),
    proFallbackRate: roundNumber(proFallbacks / Math.max(1, actions), 4),
  };
}

function summarizePolicyRuns(runs = []) {
  const totalHands = runs.length;
  const completed = runs.filter((run) => run.ok);
  const ev = completed.reduce((sum, run) => sum + Number(run.seatDelta ?? 0), 0) / Math.max(1, completed.length);
  const illegal = runs.filter((run) => !run.ok && String(run.reason).includes("invalid")).length;
  const freeze = runs.filter((run) => (!run.ok && String(run.reason).includes("max-steps")) || run.metrics?.freeze).length;
  const datasetHits = completed.reduce((sum, run) => sum + Number(run.metrics?.datasetHits ?? 0), 0);
  const actions = completed.reduce((sum, run) => sum + Number(run.metrics?.actions ?? 0), 0);
  const proFallbacks = completed.reduce((sum, run) => sum + Number(run.metrics?.proFallbacks ?? 0), 0);
  const bucketHitDistribution = {};
  const bucketHands = {};
  const bucketSeatDeltaSum = {};
  const sourceTypeHitDistribution = {};
  const sourceTypeHands = {};
  const sourceTypeSeatDeltaSum = {};
  const candidateBucketObservations = {};
  const fallbackReasonDistribution = {};
  const fallbackReasonByBucket = {};
  const actionSourceBreakdown = {
    "dataset-hit": datasetHits,
    "pro-fallback": proFallbacks,
  };
  let hitHands = 0;
  let hitSeatDeltaSum = 0;
  let fallbackOnlyHands = 0;
  let fallbackOnlySeatDeltaSum = 0;
  completed.forEach((run) => {
    const runBucketDistribution = run.metrics?.bucketHitDistribution ?? {};
    const bucketKeys = Object.keys(runBucketDistribution);
    if (Number(run.metrics?.datasetHits ?? 0) > 0) {
      hitHands += 1;
      hitSeatDeltaSum += Number(run.seatDelta ?? 0);
    }
    if (Number(run.metrics?.datasetHits ?? 0) === 0 && Number(run.metrics?.proFallbacks ?? 0) > 0) {
      fallbackOnlyHands += 1;
      fallbackOnlySeatDeltaSum += Number(run.seatDelta ?? 0);
    }
    Object.entries(runBucketDistribution).forEach(([bucket, count]) => {
      bucketHitDistribution[bucket] = (bucketHitDistribution[bucket] ?? 0) + Number(count ?? 0);
      bucketHands[bucket] = (bucketHands[bucket] ?? 0) + 1;
      bucketSeatDeltaSum[bucket] = (bucketSeatDeltaSum[bucket] ?? 0) + Number(run.seatDelta ?? 0);
    });
    Object.entries(run.metrics?.sourceTypeHitDistribution ?? {}).forEach(([sourceType, count]) => {
      sourceTypeHitDistribution[sourceType] = (sourceTypeHitDistribution[sourceType] ?? 0) + Number(count ?? 0);
      sourceTypeHands[sourceType] = (sourceTypeHands[sourceType] ?? 0) + 1;
      sourceTypeSeatDeltaSum[sourceType] = (sourceTypeSeatDeltaSum[sourceType] ?? 0) + Number(run.seatDelta ?? 0);
    });
    Object.entries(run.metrics?.candidateBucketObservations ?? {}).forEach(([bucket, count]) => {
      candidateBucketObservations[bucket] = (candidateBucketObservations[bucket] ?? 0) + Number(count ?? 0);
    });
    Object.entries(run.metrics?.fallbackReasonDistribution ?? {}).forEach(([reason, count]) => {
      fallbackReasonDistribution[reason] = (fallbackReasonDistribution[reason] ?? 0) + Number(count ?? 0);
    });
    Object.entries(run.metrics?.fallbackReasonByBucket ?? {}).forEach(([bucket, reasons]) => {
      if (!fallbackReasonByBucket[bucket]) fallbackReasonByBucket[bucket] = {};
      Object.entries(reasons ?? {}).forEach(([reason, count]) => {
        fallbackReasonByBucket[bucket][reason] = (fallbackReasonByBucket[bucket][reason] ?? 0) + Number(count ?? 0);
      });
    });
  });
  const seedGroups = new Map();
  runs.forEach((run) => {
    const key = Number(run.sourceSeed ?? run.seed ?? 0);
    if (!seedGroups.has(key)) seedGroups.set(key, []);
    seedGroups.get(key).push(run);
  });
  const perSeed = [...seedGroups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seed, seedRuns]) => ({
      seed,
      ...summarizeSeedRuns(seedRuns),
    }));
  const seedEvs = perSeed.map((entry) => Number(entry.evPerHand ?? 0));
  const meanSeedEv = seedEvs.reduce((sum, value) => sum + value, 0) / Math.max(1, seedEvs.length);
  const variance =
    seedEvs.reduce((sum, value) => sum + (value - meanSeedEv) ** 2, 0) / Math.max(1, seedEvs.length - 1 || 1);
  const stdDev = Math.sqrt(Math.max(0, variance));
  const ciHalfWidth = seedEvs.length > 0 ? (1.96 * stdDev) / Math.sqrt(seedEvs.length) : 0;
  const fallbackEV = fallbackOnlyHands > 0 ? fallbackOnlySeatDeltaSum / fallbackOnlyHands : 0;
  const bucketAttribution = Object.keys(bucketHitDistribution)
    .sort()
    .map((bucket) => {
      const hits = Number(bucketHitDistribution[bucket] ?? 0);
      const handHits = Number(bucketHands[bucket] ?? 0);
      const hitEv = handHits > 0 ? Number(bucketSeatDeltaSum[bucket] ?? 0) / handHits : 0;
      return {
        bucket,
        hits,
        handHits,
        hitRate: roundNumber(hits / Math.max(1, actions), 4),
        ironEVWhenHit: roundNumber(hitEv, 2),
        proFallbackEV: roundNumber(fallbackEV, 2),
        impact: roundNumber(hitEv - fallbackEV, 2),
      };
    });
  const sourceTypeAttribution = Object.keys(sourceTypeHitDistribution)
    .sort()
    .map((sourceType) => {
      const hits = Number(sourceTypeHitDistribution[sourceType] ?? 0);
      const handHits = Number(sourceTypeHands[sourceType] ?? 0);
      const hitEv = handHits > 0 ? Number(sourceTypeSeatDeltaSum[sourceType] ?? 0) / handHits : 0;
      return {
        sourceType,
        hits,
        handHits,
        hitRate: roundNumber(hits / Math.max(1, actions), 4),
        ironEVWhenHit: roundNumber(hitEv, 2),
        proFallbackEV: roundNumber(fallbackEV, 2),
        impact: roundNumber(hitEv - fallbackEV, 2),
      };
    });
  return {
    hands: totalHands,
    completedHands: completed.length,
    evPerHand: roundNumber(ev, 2),
    illegal,
    freeze,
    datasetHitRate: roundNumber(datasetHits / Math.max(1, actions), 4),
    proFallbackRate: roundNumber(proFallbacks / Math.max(1, actions), 4),
    bucketHitDistribution,
    bucketAttribution,
    sourceTypeAttribution,
    candidateBucketObservations,
    fallbackReasonDistribution,
    fallbackReasonByBucket,
    ironActionSourceBreakdown: actionSourceBreakdown,
    hitHands,
    fallbackOnlyHands,
    ironEVWhenHit: roundNumber(hitHands > 0 ? hitSeatDeltaSum / hitHands : 0, 2),
    proFallbackEV: roundNumber(fallbackEV, 2),
    perSeed,
    confidenceInterval95: {
      mean: roundNumber(meanSeedEv, 2),
      stdDev: roundNumber(stdDev, 4),
      lower: roundNumber(meanSeedEv - ciHalfWidth, 2),
      upper: roundNumber(meanSeedEv + ciHalfWidth, 2),
      seeds: seedEvs.length,
    },
  };
}

export async function runIronOfflineArena({
  datasetPath = DEFAULT_DATASET_PATH,
  variants = ["D02", "S01", "S02"],
  hands = 300,
  seeds = [20260524, 20260525, 20260526],
  outputPath = null,
  stabilityOutputPath = null,
  dryRunGateOutputPath = null,
  targetBucket = null,
  targetedSampling = false,
  targetMinOpportunities = 20,
  targetPlayerCount = 0,
  targetHandclass = null,
  targetPosition = null,
  targetCallBand = null,
  targetPressureChain = [],
  targetMinExactOpportunities = 0,
  maxHands = 0,
  maxDecisions = 0,
  replayCompatiblePlayercount = false,
  replayCompatibleCallband = false,
  replayCompatiblePressurechain = false,
  shadowSourceAttribution = false,
  naturalMixedExposure = false,
} = {}) {
  const arenaTag = deriveArenaTagFromDatasetPath(datasetPath);
  const arenaId = arenaTag === "iron-step7" ? "iron-step9" : arenaTag;
  const useTargetedDefaults = targetedSampling && targetBucket === STEP16_TARGET_BUCKET;
  const useStep17TargetedDefaults = useTargetedDefaults && targetPlayerCount > 0;
  const useStep41TargetedDefaults = targetedSampling && targetBucket === STEP41_S02_DEEP_RAISE_CHECK_TARGET;
  const resolvedOutputPath =
    outputPath ??
    (useStep41TargetedDefaults
      ? defaultStep41TargetedArenaPath("result")
      : naturalMixedExposure
        ? defaultStep45NaturalMixedArenaPath("result")
      : useStep17TargetedDefaults
      ? defaultStep17TargetedArenaPath("result")
      : useTargetedDefaults
        ? defaultTargetedArenaPath("result")
        : defaultArenaPath("result", datasetPath));
  const resolvedStabilityOutputPath =
    stabilityOutputPath ??
    (useStep41TargetedDefaults
      ? defaultStep41TargetedArenaPath("stability")
      : naturalMixedExposure
        ? defaultStep45NaturalMixedArenaPath("stability")
      : useStep17TargetedDefaults
      ? defaultStep17TargetedArenaPath("stability")
      : useTargetedDefaults
        ? defaultTargetedArenaPath("stability")
        : defaultArenaPath("stability", datasetPath));
  const resolvedDryRunGateOutputPath =
    dryRunGateOutputPath ??
    (useStep41TargetedDefaults
      ? defaultStep41TargetedArenaPath("dryrun-gate")
      : naturalMixedExposure
        ? defaultStep45NaturalMixedArenaPath("dryrun-gate")
      : useStep17TargetedDefaults
      ? defaultStep17TargetedArenaPath("dryrun-gate")
      : useTargetedDefaults
        ? defaultTargetedArenaPath("dryrun-gate")
        : defaultArenaPath("dryrun-gate", datasetPath));
  const eligibility = await checkIronDryRunEligibility({ datasetPath, outputPath: resolvedDryRunGateOutputPath });
  const candidatePolicy = await createIronCandidatePolicy({
    datasetPath,
    reconciliationOptions: {
      replayCompatiblePlayercount,
      replayCompatibleCallband,
      replayCompatiblePressurechain,
    },
  });
  const results = [];
  const playerCount = 6;
  for (const variantId of variants) {
    const policyRuns = { iron: [], pro: [], standard: [] };
    const opportunityProfiles = [];
    const tableSizeHandDistribution = { "6max": 0, "4max": 0, "3way": 0 };
    let targetedHands = 0;
    for (const [seedIndex, seed] of seeds.entries()) {
      for (let handIndex = 0; handIndex < hands; handIndex += 1) {
        if (maxHands > 0 && targetedHands >= maxHands) break;
        if (maxDecisions > 0 && opportunityProfiles.length >= maxDecisions) break;
        if (
          targetedSampling &&
          targetBucket === STEP16_TARGET_BUCKET &&
          variantId === "S02" &&
          summarizeS02RelaxedOpportunityProfiles(opportunityProfiles).exactOpportunities >=
            Math.max(1, targetMinExactOpportunities || targetMinOpportunities)
        ) {
          break;
        }
        const handPlayerCount =
          naturalMixedExposure
            ? naturalMixedExposurePlayerCount(handIndex, seedIndex)
            : useStep41TargetedDefaults && variantId === "S02"
            ? (handIndex + seeds.indexOf(seed)) % 2 === 0
              ? 3
              : 4
            : playerCount;
        const tableKey = handPlayerCount === 3 ? "3way" : handPlayerCount === 4 ? "4max" : "6max";
        tableSizeHandDistribution[tableKey] = (tableSizeHandDistribution[tableKey] ?? 0) + 1;
        const evaluatedSeat = handIndex % handPlayerCount;
        const handSeed = seed + handIndex * 97;
        targetedHands += 1;
        policyRuns.iron.push(
          await playArenaHand({
            variantId,
            seed: handSeed,
            sourceSeed: seed,
            handIndex,
            evaluatedSeat,
            evaluatedPolicy: "iron",
            candidatePolicy,
            targetBucket,
            opportunityProfiles,
            replayCompatiblePlayercount,
            replayCompatibleCallband,
            replayCompatiblePressurechain,
            playerCount: handPlayerCount,
          }),
        );
        policyRuns.pro.push(
          await playArenaHand({
            variantId,
            seed: handSeed,
            sourceSeed: seed,
            handIndex,
            evaluatedSeat,
            evaluatedPolicy: "pro",
            playerCount: handPlayerCount,
          }),
        );
        policyRuns.standard.push(
          await playArenaHand({
            variantId,
            seed: handSeed,
            sourceSeed: seed,
            handIndex,
            evaluatedSeat,
            evaluatedPolicy: "standard",
            playerCount: handPlayerCount,
          }),
        );
      }
    }
    const iron = summarizePolicyRuns(policyRuns.iron);
    const pro = summarizePolicyRuns(policyRuns.pro);
    const standard = summarizePolicyRuns(policyRuns.standard);
    results.push({
      variant: variantId,
      ironEv: iron.evPerHand,
      proEv: pro.evPerHand,
      standardEv: standard.evPerHand,
      ironProGap: Number((iron.evPerHand - pro.evPerHand).toFixed(2)),
      ironStandardGap: Number((iron.evPerHand - standard.evPerHand).toFixed(2)),
      illegal: iron.illegal,
      freeze: iron.freeze,
      fallback: iron.proFallbackRate,
      datasetHitRate: iron.datasetHitRate,
      proFallbackRate: iron.proFallbackRate,
      bucketHitDistribution: iron.bucketHitDistribution,
      bucketAttribution: iron.bucketAttribution,
      sourceTypeAttribution: iron.sourceTypeAttribution,
      candidateBucketObservations: iron.candidateBucketObservations,
      fallbackReasonDistribution: iron.fallbackReasonDistribution,
      fallbackReasonByBucket: iron.fallbackReasonByBucket,
      ironActionSourceBreakdown: iron.ironActionSourceBreakdown,
      ironEVWhenHit: iron.ironEVWhenHit,
      proFallbackEV: iron.proFallbackEV,
      hitHands: iron.hitHands,
      fallbackOnlyHands: iron.fallbackOnlyHands,
      targetBucketProfile:
        targetedSampling && targetBucket === STEP16_TARGET_BUCKET && variantId === "S02"
          ? summarizeS02RelaxedOpportunityProfiles(opportunityProfiles)
          : null,
      perSeed: seeds.map((seed) => {
        const ironSeed = iron.perSeed.find((entry) => entry.seed === seed) ?? null;
        const proSeed = pro.perSeed.find((entry) => entry.seed === seed) ?? null;
        const standardSeed = standard.perSeed.find((entry) => entry.seed === seed) ?? null;
        return {
          seed,
          ironEv: ironSeed?.evPerHand ?? 0,
          proEv: proSeed?.evPerHand ?? 0,
          standardEv: standardSeed?.evPerHand ?? 0,
          ironProGap: roundNumber((ironSeed?.evPerHand ?? 0) - (proSeed?.evPerHand ?? 0), 2),
          ironStandardGap: roundNumber((ironSeed?.evPerHand ?? 0) - (standardSeed?.evPerHand ?? 0), 2),
          datasetHitRate: ironSeed?.datasetHitRate ?? 0,
          proFallbackRate: ironSeed?.proFallbackRate ?? 0,
        };
      }),
      confidenceInterval95: iron.confidenceInterval95,
      naturalMixedExposure,
      tableSizeHandDistribution,
      tableSizeObservedShare: summarizeTableSizeDistribution(tableSizeHandDistribution),
    });
    if (targetedSampling && targetBucket === STEP16_TARGET_BUCKET && variantId === "S02") {
      await writeS02RelaxedOpportunityArtifacts({
        profiles: opportunityProfiles,
        outputPath: useStep17TargetedDefaults ? DEFAULT_STEP17_OPPORTUNITY_OUTPUT_PATH : DEFAULT_STEP16_OPPORTUNITY_OUTPUT_PATH,
        nearMissOutputPath: useStep17TargetedDefaults ? DEFAULT_STEP17_NEAR_MISS_OUTPUT_PATH : DEFAULT_STEP16_NEAR_MISS_OUTPUT_PATH,
      });
      if (useStep17TargetedDefaults) {
        await writeS02PlayerCountOpportunityProfile({
          profiles: opportunityProfiles,
          outputPath: DEFAULT_STEP17_PLAYERCOUNT_OUTPUT_PATH,
        });
        if (replayCompatiblePlayercount) {
          await writeArenaDecisionTimingTrace({
            profiles: opportunityProfiles,
            outputPath: DEFAULT_STEP18_DECISION_TIMING_TRACE_PATH,
          });
        }
      }
    }
  }

  const attribution = analyzeIronDatasetHits({
    arenaId,
    datasetPath,
    results,
    promoted: false,
    routingChanged: false,
  });

  const stabilityReport = {
    arenaId,
    variants,
    hands,
    seeds,
    dryRunEligibility: eligibility,
    results: results.map((result) => ({
      variant: result.variant,
      ironEv: result.ironEv,
      proEv: result.proEv,
      standardEv: result.standardEv,
      ironProGap: result.ironProGap,
      ironStandardGap: result.ironStandardGap,
      datasetHitRate: result.datasetHitRate,
      proFallbackRate: result.proFallbackRate,
      perSeed: result.perSeed,
      confidenceInterval95: result.confidenceInterval95,
      bucketHitDistribution: result.bucketHitDistribution,
      sourceTypeAttribution: result.sourceTypeAttribution,
      candidateBucketObservations: result.candidateBucketObservations,
      fallbackReasonDistribution: result.fallbackReasonDistribution,
      ironActionSourceBreakdown: result.ironActionSourceBreakdown,
      targetBucketProfile: result.targetBucketProfile,
    })),
    promoted: false,
    eligibleForPromotion: false,
    routingChanged: false,
  };

  const report = {
    arenaId,
    variants,
    candidate: "iron-candidate-dryrun",
    baselinePolicies: ["standard", "pro"],
    datasetPath,
    targetBucket,
    targetedSampling,
    targetMinOpportunities,
    targetPlayerCount,
    targetHandclass,
    targetPosition,
    targetCallBand,
    targetPressureChain,
    targetMinExactOpportunities,
    maxHands,
    maxDecisions,
    replayCompatiblePlayercount,
    replayCompatibleCallband,
    replayCompatiblePressurechain,
    shadowSourceAttribution,
    naturalMixedExposure,
    tableSizeWeights: naturalMixedExposure ? { "6max": 0.5, "4max": 0.25, "3way": 0.25 } : null,
    dryRunEligibility: eligibility,
    results,
    hitAttributionPath: path.resolve("reports/ai-iron", `${arenaId}-dataset-hit-attribution.json`),
    stabilityPath: resolvedStabilityOutputPath,
    promoted: false,
    eligibleForPromotion: false,
    routingChanged: false,
  };

  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await fs.writeFile(resolvedOutputPath, JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(resolvedStabilityOutputPath, JSON.stringify(stabilityReport, null, 2), "utf8");
  await fs.writeFile(report.hitAttributionPath, JSON.stringify(attribution, null, 2), "utf8");
  return report;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await runIronOfflineArena(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
}
