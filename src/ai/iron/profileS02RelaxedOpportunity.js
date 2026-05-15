import fs from "node:fs/promises";
import path from "node:path";

import {
  extractToCall,
  normalizePlayerCountBand,
  normalizePositionBand,
  normalizeRepeatedPressureFlag,
  normalizeToCallBand,
} from "../evaluation/discoverStableNeighborBuckets.js";
import { classifyS02V3IsolationAxes, STEP14_S02_TARGET_BUCKET } from "../evaluation/analyzeS02V3NoiseEntropy.js";
import {
  buildBucketMatch,
  classifyHandClassForVariant,
  createS02OpportunityContext,
  deriveTablePositionLabel,
  evaluateSpecializedS02Match,
  getActorHand,
  getFacingAction,
} from "./ironCandidatePolicy.js";
import { replayCompatibleCallBand } from "./reconcileCallBand.js";
import { replayCompatiblePressureChain } from "./reconcilePressureChain.js";
import { countPlayerFlags, effectiveOpportunityPlayerCount } from "./reconcileArenaPlayerCount.js";

export const STEP16_TARGET_BUCKET = "S02_RELAXED_V3";
export const DEFAULT_STEP16_OPPORTUNITY_OUTPUT_PATH = path.resolve("reports/ai-iron/s02-relaxed-opportunity-profile-step16.json");
export const DEFAULT_STEP16_NEAR_MISS_OUTPUT_PATH = path.resolve("reports/ai-iron/s02-relaxed-near-miss-step16.jsonl");
export const DEFAULT_STEP17_OPPORTUNITY_OUTPUT_PATH = path.resolve("reports/ai-iron/s02-relaxed-opportunity-profile-step17.json");
export const DEFAULT_STEP17_NEAR_MISS_OUTPUT_PATH = path.resolve("reports/ai-iron/s02-relaxed-near-miss-step17.jsonl");
export const DEFAULT_STEP17_PLAYERCOUNT_OUTPUT_PATH = path.resolve("reports/ai-iron/s02-playercount-opportunity-step17.json");
const RELAXED_ALLOWED_PRESSURE_CHAINS = new Set(["firstRaiseAfterCall", "repeatedPressure"]);

function round(value, digits = 4) {
  return Number(Number(value ?? 0).toFixed(digits));
}

function actionType(action = null) {
  return String(action?.type ?? action ?? "").toUpperCase();
}

function countActivePlayers(snapshot = {}) {
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

function countPotContributors(snapshot = {}) {
  return (snapshot?.players ?? []).filter((player) => Number(player?.betThisRound ?? player?.betThisStreet ?? player?.bet ?? 0) > 0)
    .length;
}

function countBettingParticipants(snapshot = {}) {
  return (snapshot?.players ?? []).filter((player) => {
    if (!player || player.folded || player.hasFolded || player.seatOut || player.sittingOut) return false;
    return Number(player?.betThisRound ?? player?.betThisStreet ?? player?.bet ?? 0) > 0;
  }).length;
}

export function classifyS02RelaxedOpportunityDecision({
  variantId,
  snapshot,
  seatIndex,
  legalActions = [],
  decisionMetadata = {},
  specializedRows = [],
  selectedAction = null,
  replayCompatibleMode = false,
  replayCompatibleCallband = false,
  replayCompatiblePressurechain = false,
} = {}) {
  if (String(variantId ?? "").toUpperCase() !== "S02") return null;
  const handClass = classifyHandClassForVariant("S02", getActorHand(snapshot, seatIndex));
  const playerFlags = countPlayerFlags(snapshot);
  const activePlayersAtDecision = countActivePlayers(snapshot);
  const activePlayersAtHandStart = Array.isArray(snapshot?.players) ? snapshot.players.length : activePlayersAtDecision;
  const potContributorsCount = countPotContributors(snapshot);
  const bettingParticipantsCount = countBettingParticipants(snapshot);
  const playerCountArena = activePlayersAtDecision;
  const reconciledPlayerCount = effectiveOpportunityPlayerCount({
    activePlayers: playerFlags.activePlayers,
    foldedPlayers: playerFlags.foldedPlayers,
    allInPlayers: playerFlags.allInPlayers,
    bettingEligiblePlayers: bettingParticipantsCount,
    potEligiblePlayers: potContributorsCount,
    replayCompatibleMode,
  });
  const playerCount = replayCompatibleMode ? reconciledPlayerCount : playerCountArena;
  const positionLabel = deriveTablePositionLabel(snapshot, seatIndex);
  const positionBand = normalizePositionBand(positionLabel);
  const facingAction = getFacingAction(snapshot, seatIndex);
  const toCall = extractToCall(legalActions, snapshot, seatIndex);
  const toCallBandRaw = normalizeToCallBand(toCall);
  const toCallBand = replayCompatibleCallband
    ? replayCompatibleCallBand({
        toCall,
        pot: Number(snapshot?.pot ?? snapshot?.metadata?.pot ?? 0) || 0,
        stack: Number(snapshot?.players?.[seatIndex]?.stack ?? 0) || 0,
        limitUnit: Number(snapshot?.bigBlind ?? 20) || 20,
        street: Number(snapshot?.drawRound ?? snapshot?.metadata?.drawRound ?? 0) || 0,
        variantId,
      })
    : toCallBandRaw;
  const repeatedPressureRaw = normalizeRepeatedPressureFlag(facingAction);
  const bucket = buildBucketMatch({ variantId, snapshot, seatIndex, legalActions });
  const context = createS02OpportunityContext({ snapshot, seatIndex, legalActions, bucket });
  const specializedMatch = context ? evaluateSpecializedS02Match({ rows: specializedRows, context }) : null;
  const pressureChainRaw = context?.axes?.pressureChain ?? classifyS02V3IsolationAxes({
    actorSeat: seatIndex,
    position: positionLabel,
    drawRound: snapshot?.drawRound ?? snapshot?.metadata?.drawRound ?? 0,
    legalActions,
    state: { snapshot },
    facingAction,
  }).pressureChain;
  const pressureChainResolved = replayCompatiblePressurechain
    ? replayCompatiblePressureChain({
        pressureChain: pressureChainRaw,
        repeatedPressure: repeatedPressureRaw,
      })
    : {
        pressureChain: pressureChainRaw,
        repeatedPressure: repeatedPressureRaw,
        family: pressureChainRaw || repeatedPressureRaw,
        reconciled: false,
      };
  const pressureChain = pressureChainResolved.pressureChain;
  const repeatedPressure = pressureChainResolved.repeatedPressure;

  const profile = {
    decisionId: `${variantId}|${snapshot?.handNumber ?? snapshot?.metadata?.handNumber ?? "unknown"}|${seatIndex}|${snapshot?.actionOn ?? "na"}`,
    variant: "S02",
    handClass,
    playerCountBand: normalizePlayerCountBand(playerCount),
    playerCount,
    playerCountArena,
    playerCountReconciled: reconciledPlayerCount,
    activePlayersAtHandStart,
    activePlayersAtDecision,
    activeNonFoldedPlayers: playerFlags.activeNonFoldedPlayers,
    activeNonAllInPlayers: playerFlags.activeNonAllInPlayers,
    foldedPlayers: [...playerFlags.foldedPlayers],
    allInPlayers: [...playerFlags.allInPlayers],
    effectivePlayerCount: Math.max(
      playerCount,
      potContributorsCount,
      bettingParticipantsCount,
    ),
    potContributorsCount,
    bettingParticipantsCount,
    positionBand,
    position: positionLabel,
    callBand: toCallBand,
    callBandRaw: toCallBandRaw,
    toCall,
    repeatedPressure,
    repeatedPressureRaw,
    pressureChain,
    pressureChainRaw,
    playerCountTransition:
      activePlayersAtHandStart > activePlayersAtDecision
        ? `collapsed-${activePlayersAtHandStart}-to-${activePlayersAtDecision}`
        : `held-${activePlayersAtDecision}`,
    replayCompatibleMode,
    exactOpportunity: false,
    datasetActionLegal: false,
    source: decisionMetadata?.ironDryRunMatched ? "dataset-hit" : "pro-fallback",
    selectedSource: decisionMetadata?.matchedSourceType ?? null,
    shadowSource: decisionMetadata?.shadowSourceAttribution?.shadowRelaxedSource ?? null,
    shadowOnly: Boolean(decisionMetadata?.shadowSourceAttribution),
    sourceSpecificityScores: decisionMetadata?.sourceSpecificityScores ?? [],
    sourcePriorityOrder: decisionMetadata?.sourcePriorityOrder ?? [],
    selectedAction: selectedAction ? { type: actionType(selectedAction) } : null,
    datasetAction: null,
    mismatchReason: "NO_STRONG_SDA5",
  };

  if (handClass !== "strongSDA5") return profile;
  if (profile.playerCountBand !== "3way") {
    profile.mismatchReason = "PLAYERCOUNT_MISMATCH";
    return profile;
  }
  if (positionBand !== "IP") {
    profile.mismatchReason = "POSITION_MISMATCH";
    return profile;
  }
  if (toCallBand !== "small") {
    profile.mismatchReason = "CALL_BAND_MISMATCH";
    return profile;
  }
  if (repeatedPressure !== "repeated") {
    profile.mismatchReason = "PRESSURE_CHAIN_MISMATCH";
    return profile;
  }
  if (!RELAXED_ALLOWED_PRESSURE_CHAINS.has(String(pressureChain ?? ""))) {
    profile.mismatchReason = "PRESSURE_CHAIN_MISMATCH";
    return profile;
  }

  profile.exactOpportunity = true;
  const relaxedRow = specializedRows.find(
    (row) =>
      String(row.sourceType) === "verified-relaxed-match" &&
      String(row.parentStableBucket ?? row.metadata?.parentStableBucket ?? "") === STEP14_S02_TARGET_BUCKET,
  );
  if (!relaxedRow) {
    profile.mismatchReason = "NO_MATCHING_STATE";
    return profile;
  }
  profile.datasetAction = relaxedRow.chosenBestAction ?? null;
  const datasetActionLegal = (Array.isArray(legalActions) ? legalActions : []).some(
    (entry) => actionType(entry) === actionType(relaxedRow.chosenBestAction),
  );
  profile.datasetActionLegal = datasetActionLegal;
  if (!datasetActionLegal) {
    profile.mismatchReason = "DATASET_ACTION_NOT_LEGAL";
    return profile;
  }
  if (decisionMetadata?.ironDryRunMatched && String(decisionMetadata?.matchedSourceType ?? "") === "verified-relaxed-match") {
    profile.mismatchReason = "EXACT_HIT";
    return profile;
  }
  if (decisionMetadata?.ironDryRunMatched) {
    profile.mismatchReason = "MATCHED_BUT_NOT_SELECTED";
    return profile;
  }
  profile.mismatchReason = "LEGAL_BUT_NOT_SELECTED";
  return profile;
}

export function summarizeS02RelaxedOpportunityProfiles(profiles = []) {
  const summary = {
    targetBucket: STEP16_TARGET_BUCKET,
    totalS02Decisions: 0,
    strongSDA5Decisions: 0,
    playerCount3way: 0,
    ipDecisions: 0,
    smallCallDecisions: 0,
    pressureChainMatch: 0,
    exactOpportunities: 0,
    nearOpportunities: 0,
    datasetActionLegalCount: 0,
    finalDatasetHits: 0,
    nearMisses: 0,
    strongSDA5ByPlayerCount: {
      HU: 0,
      "3way": 0,
      "4way+": 0,
    },
    strongSDA5ByArenaPlayerCount: {
      HU: 0,
      "3way": 0,
      "4way+": 0,
    },
    playerCountTransitions: {},
    activePlayersAtHandStart: {},
    activePlayersAtDecision: {},
    playerCountArena: {},
    playerCountReconciled: {},
    effectivePlayerCount: {},
    potContributorsCount: {},
    bettingParticipantsCount: {},
    mismatchReasons: {
      NO_STRONG_SDA5: 0,
      PLAYERCOUNT_MISMATCH: 0,
      POSITION_MISMATCH: 0,
      CALL_BAND_MISMATCH: 0,
      PRESSURE_CHAIN_MISMATCH: 0,
      ACTION_ILLEGAL: 0,
      DATASET_ACTION_NOT_LEGAL: 0,
      MATCHED_BUT_NOT_SELECTED: 0,
      LEGAL_BUT_NOT_SELECTED: 0,
      EXACT_HIT: 0,
      NO_MATCHING_STATE: 0,
    },
  };

  for (const profile of profiles) {
    summary.totalS02Decisions += 1;
    if (profile.handClass === "strongSDA5") {
      summary.strongSDA5Decisions += 1;
      const band = String(profile.playerCountBand ?? "4way+");
      summary.strongSDA5ByPlayerCount[band] = (summary.strongSDA5ByPlayerCount[band] ?? 0) + 1;
      const arenaBand = normalizePlayerCountBand(Number(profile.playerCountArena ?? profile.playerCount ?? 0));
      summary.strongSDA5ByArenaPlayerCount[arenaBand] = (summary.strongSDA5ByArenaPlayerCount[arenaBand] ?? 0) + 1;
    }
    if (profile.playerCountBand === "3way") summary.playerCount3way += 1;
    if (profile.positionBand === "IP") summary.ipDecisions += 1;
    if (profile.callBand === "small") summary.smallCallDecisions += 1;
    if (RELAXED_ALLOWED_PRESSURE_CHAINS.has(String(profile.pressureChain ?? ""))) summary.pressureChainMatch += 1;
    if (profile.exactOpportunity) summary.exactOpportunities += 1;
    if (profile.datasetActionLegal) summary.datasetActionLegalCount += 1;
    if (profile.mismatchReason === "EXACT_HIT") summary.finalDatasetHits += 1;
    if (profile.exactOpportunity && profile.mismatchReason !== "EXACT_HIT") summary.nearOpportunities += 1;
    if (profile.mismatchReason !== "EXACT_HIT") summary.nearMisses += 1;
    const transition = String(profile.playerCountTransition ?? "unknown");
    summary.playerCountTransitions[transition] = (summary.playerCountTransitions[transition] ?? 0) + 1;
    const handStart = String(profile.activePlayersAtHandStart ?? "unknown");
    summary.activePlayersAtHandStart[handStart] = (summary.activePlayersAtHandStart[handStart] ?? 0) + 1;
    const atDecision = String(profile.activePlayersAtDecision ?? "unknown");
    summary.activePlayersAtDecision[atDecision] = (summary.activePlayersAtDecision[atDecision] ?? 0) + 1;
    const arenaCount = String(profile.playerCountArena ?? "unknown");
    summary.playerCountArena[arenaCount] = (summary.playerCountArena[arenaCount] ?? 0) + 1;
    const reconciledCount = String(profile.playerCountReconciled ?? "unknown");
    summary.playerCountReconciled[reconciledCount] = (summary.playerCountReconciled[reconciledCount] ?? 0) + 1;
    const effective = String(profile.effectivePlayerCount ?? "unknown");
    summary.effectivePlayerCount[effective] = (summary.effectivePlayerCount[effective] ?? 0) + 1;
    const potContributors = String(profile.potContributorsCount ?? "unknown");
    summary.potContributorsCount[potContributors] = (summary.potContributorsCount[potContributors] ?? 0) + 1;
    const participants = String(profile.bettingParticipantsCount ?? "unknown");
    summary.bettingParticipantsCount[participants] = (summary.bettingParticipantsCount[participants] ?? 0) + 1;
    const reason = String(profile.mismatchReason ?? "NO_MATCHING_STATE");
    summary.mismatchReasons[reason] = (summary.mismatchReasons[reason] ?? 0) + 1;
  }
  return summary;
}

export async function writeS02RelaxedOpportunityArtifacts({
  profiles = [],
  outputPath = DEFAULT_STEP16_OPPORTUNITY_OUTPUT_PATH,
  nearMissOutputPath = DEFAULT_STEP16_NEAR_MISS_OUTPUT_PATH,
} = {}) {
  const summary = summarizeS02RelaxedOpportunityProfiles(profiles);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), "utf8");
  const nearMissLines = profiles
    .filter((profile) => profile.mismatchReason !== "EXACT_HIT")
    .map((profile) => JSON.stringify(profile))
    .join("\n");
  await fs.writeFile(nearMissOutputPath, nearMissLines ? `${nearMissLines}\n` : "", "utf8");
  return { summary, outputPath, nearMissOutputPath };
}

export async function writeS02PlayerCountOpportunityProfile({
  profiles = [],
  outputPath = DEFAULT_STEP17_PLAYERCOUNT_OUTPUT_PATH,
} = {}) {
  const summary = summarizeS02RelaxedOpportunityProfiles(profiles);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), "utf8");
  return { summary, outputPath };
}
