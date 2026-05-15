import { evaluateLowHand } from "../../games/evaluators/low.js";
import { classifyStableNeighborContext } from "../evaluation/discoverStableNeighborBuckets.js";
import {
  STEP14_S02_TARGET_BUCKET,
  classifyS02V3IsolationAxes,
} from "../evaluation/analyzeS02V3NoiseEntropy.js";
import { loadActionValueDataset } from "./loadActionValueDataset.js";
import { replayCompatibleCallBand } from "./reconcileCallBand.js";
import { replayCompatiblePressureChain } from "./reconcilePressureChain.js";
import { effectiveOpportunityPlayerCount } from "./reconcileArenaPlayerCount.js";
import { createShadowSourceAttribution } from "./createShadowSourceAttribution.js";
import { bucketSpecificityScore, SOURCE_PRIORITY_ORDER } from "./scoreBucketSpecificity.js";

export const STEP41_S02_DEEP_RAISE_CHECK_TARGET = "S02_DEEP_RAISE_CHECK";
export const STEP41_S02_DEEP_RAISE_CHECK_FAMILY = "S02 deep RAISE-vs-CHECK";

function normalizeCard(card = "") {
  return String(card ?? "").trim().toUpperCase();
}

function getActorPlayer(snapshot = {}, seatIndex = 0) {
  return snapshot?.players?.[seatIndex] ?? null;
}

export function getActorHand(snapshot = {}, seatIndex = 0) {
  const player = getActorPlayer(snapshot, seatIndex);
  const hand = player?.hand ?? player?.cards ?? [];
  return Array.isArray(hand) ? [...hand] : [];
}

export function getCurrentBet(snapshot = {}, seatIndex = 0) {
  const player = getActorPlayer(snapshot, seatIndex) ?? {};
  const currentBet = Number(snapshot?.currentBet ?? snapshot?.metadata?.currentBet ?? 0) || 0;
  const playerBet = Number(player?.betThisRound ?? player?.betThisStreet ?? player?.bet ?? 0) || 0;
  return Math.max(0, currentBet - playerBet);
}

export function getFacingAction(snapshot = {}, seatIndex = 0) {
  const toCall = getCurrentBet(snapshot, seatIndex);
  if (toCall <= 0) return "none";
  const raiseCountThisRound = Number(snapshot?.metadata?.raiseCountThisRound ?? snapshot?.raiseCountThisRound ?? 0) || 0;
  return raiseCountThisRound > 0 ? "raise" : "bet";
}

function analyzeLowTexture(ranks = [], lowType = "27") {
  const ordered = [...ranks].map((rank) => Number(rank) || 99).sort((a, b) => a - b);
  const highest = ordered[ordered.length - 1] ?? 99;
  const secondHighest = ordered[ordered.length - 2] ?? 99;
  const largestGap = ordered.slice(1).reduce((gap, rank, index) => Math.max(gap, rank - ordered[index]), 0);
  const smoothHigh = lowType === "A5" ? 7 : 8;
  return {
    highest,
    secondHighest,
    largestGap,
    isSmooth:
      highest <= smoothHigh &&
      secondHighest <= (lowType === "A5" ? 5 : 6) &&
      largestGap <= 2,
    isRough:
      highest >= (lowType === "A5" ? 8 : 9) ||
      secondHighest >= (lowType === "A5" ? 6 : 7) ||
      largestGap >= 4,
  };
}

export function classifyHandClassForVariant(variantId, hand = []) {
  if (variantId === "D02" || variantId === "S02") {
    const evaluation = evaluateLowHand({ cards: hand, lowType: "A5" });
    const ranks = evaluation?.metadata?.ranks ?? [];
    const paired = new Set(ranks.map(Number)).size < ranks.length;
    const highestRank = ranks[0] ?? 99;
    const category = String(evaluation?.metadata?.category ?? "");
    const cleanLow = Boolean(
      evaluation?.metadata?.isLow ??
        evaluation?.metadata?.qualifiesLow ??
        ["highCard", "straight", "flush", "straightFlush"].includes(category),
    );
    const texture = analyzeLowTexture(ranks, "A5");
    if (paired || !cleanLow) return highestRank >= 10 || paired ? "trashA5" : "weakA5";
    if (variantId === "D02") {
      if (highestRank <= 6) return "premiumA5";
      if (highestRank === 7 && texture.isSmooth) return "strongA5";
      if ((highestRank === 7 && !texture.isRough) || (highestRank === 8 && texture.isSmooth)) return "mediumA5";
      if (highestRank <= 9) return "weakA5";
      return "trashA5";
    }
    if (highestRank <= 6) return "premiumSDA5";
    if (highestRank === 7) return "strongSDA5";
    if (highestRank === 8) {
      return (texture.secondHighest ?? 99) <= 4 && (texture.largestGap ?? 99) <= 3
        ? "upperMediumSDA5"
        : "lowerMediumSDA5";
    }
    if (highestRank <= 10) return "weakSDA5";
    return "trashSDA5";
  }

  if (variantId === "S01") {
    const evaluation = evaluateLowHand({ cards: hand, lowType: "27" });
    const ranks = evaluation?.metadata?.ranks ?? [];
    const paired = new Set(ranks.map(Number)).size < ranks.length;
    const highestRank = ranks[0] ?? 99;
    const category = String(evaluation?.metadata?.category ?? "");
    const texture = analyzeLowTexture(ranks, "27");
    if (paired || ["pair", "straight", "flush", "straightFlush"].includes(category)) return "trashSD27";
    if (highestRank <= 7) return "premiumSD27";
    if (highestRank === 8) return texture.isSmooth ? "premiumSD27" : "strongSD27";
    if (highestRank === 9) {
      return (texture.secondHighest ?? 99) <= 6 && (texture.largestGap ?? 99) <= 3
        ? "upperMediumSD27"
        : "lowerMediumSD27";
    }
    if (highestRank === 10) return "lowerMediumSD27";
    if (highestRank <= 12) return "weakSD27";
    return "trashSD27";
  }

  return "unknown";
}

function legalActionTypeSet(legalActions = []) {
  return new Set((Array.isArray(legalActions) ? legalActions : []).map((action) => String(action?.type ?? action).toUpperCase()));
}

function hasLegalActionType(legalActions = [], actionType = "") {
  const wanted = String(actionType ?? "").toUpperCase();
  return legalActionTypeSet(legalActions).has(wanted);
}

function stackDepthFromSnapshot(snapshot = {}, seatIndex = 0) {
  const stack = Number(snapshot?.players?.[seatIndex]?.stack ?? 0);
  if (stack >= 400) return "deep";
  if (stack >= 200) return "medium";
  if (stack > 0) return "shallow";
  return "unknown";
}

export function deriveTablePositionLabel(snapshot = {}, seatIndex = 0) {
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  const playerCount = players.length;
  const dealerIndex = Number(snapshot?.dealerIndex ?? -1);
  const sbIndex = Number(snapshot?.metadata?.lastBlinds?.sbIndex ?? -1);
  const bbIndex = Number(snapshot?.metadata?.lastBlinds?.bbIndex ?? -1);
  if (seatIndex === dealerIndex) return "button";
  if (seatIndex === sbIndex || seatIndex === bbIndex) return "blind";
  if (playerCount > 0 && dealerIndex >= 0) {
    const cutoffIndex = (dealerIndex - 1 + playerCount) % playerCount;
    if (seatIndex === cutoffIndex) return "cutoff";
  }
  return seatIndex > dealerIndex ? "late" : "early";
}

function normalizeReplayCompatiblePositionBand(position = "") {
  const normalized = String(position ?? "").toLowerCase();
  if (["button", "cutoff", "late"].includes(normalized)) return "IP";
  if (normalized.includes("blind")) return "blind";
  return "OOP";
}

function parseBucketIsolationValue(bucket = "", axis = "") {
  const marker = `::${String(axis ?? "")}=`;
  const index = String(bucket ?? "").lastIndexOf(marker);
  if (index === -1) return null;
  return String(bucket).slice(index + marker.length);
}

function buildRelaxedCriteriaFromRow(row = {}) {
  const metadata = row?.metadata ?? {};
  const relaxedAxes = Array.isArray(row?.relaxedAxes)
    ? row.relaxedAxes
    : Array.isArray(metadata?.relaxedAxes)
      ? metadata.relaxedAxes
      : [];
  const relaxedAxisValues = row?.relaxedAxisValues ?? metadata?.relaxedAxisValues ?? {};
  return {
    relaxedAxes,
    relaxedAxisValues,
  };
}

export function createS02OpportunityContext({ snapshot = {}, seatIndex = 0, legalActions = [], bucket = null } = {}) {
  if (!bucket || bucket.bucket !== STEP14_S02_TARGET_BUCKET) return null;
  const position = deriveTablePositionLabel(snapshot, seatIndex);
  const facingAction = getFacingAction(snapshot, seatIndex);
  const axes = classifyS02V3IsolationAxes({
    actorSeat: seatIndex,
    position,
    drawRound: snapshot?.drawRound ?? snapshot?.metadata?.drawRound ?? 0,
    legalActions,
    state: { snapshot },
    facingAction,
  });
  return {
    parentBucket: STEP14_S02_TARGET_BUCKET,
    axes,
    position,
    facingAction,
  };
}

function buildSpecializedMatchIndexes(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) =>
      ["verified-neighbor-v3-isolated", "verified-relaxed-match"].includes(String(row?.sourceType ?? row?.metadata?.sourceType ?? "")),
    )
    .map((row) => {
      const sourceType = String(row?.sourceType ?? row?.metadata?.sourceType ?? "");
      const isolationAxis = String(row?.isolationAxis ?? row?.metadata?.isolationAxis ?? "");
      const isolationValue = parseBucketIsolationValue(row?.bucket, isolationAxis);
      const relaxed = buildRelaxedCriteriaFromRow(row);
      return {
        ...row,
        sourceType,
        isolationAxis,
        isolationValue,
        relaxedAxes: relaxed.relaxedAxes,
        relaxedAxisValues: relaxed.relaxedAxisValues,
      };
    });
}

export function evaluateSpecializedS02Match({ rows = [], context = null }) {
  if (!context || !rows.length) {
    return { matchedRow: null, fallbackReason: "NO_MATCHING_STATE", exactOpportunityCount: 0, nearOpportunityCount: 0 };
  }
  const exactRows = [];
  const nearReasons = {
    PRESSURE_CHAIN_MISMATCH: 0,
    STACK_DEPTH_MISMATCH: 0,
    POSITION_MISMATCH: 0,
    PLAYER_COUNT_MISMATCH: 0,
    CALL_BAND_MISMATCH: 0,
  };

  for (const row of rows) {
    if (String(row?.parentStableBucket ?? row?.metadata?.parentStableBucket ?? "") !== context.parentBucket) continue;
    if (row.sourceType === "verified-neighbor-v3-isolated") {
      if (String(context.axes?.[row.isolationAxis] ?? "") === String(row.isolationValue ?? "")) {
        exactRows.push(row);
      } else {
        const axisReasonMap = {
          pressureChain: "PRESSURE_CHAIN_MISMATCH",
          stackDepth: "STACK_DEPTH_MISMATCH",
          position: "POSITION_MISMATCH",
          playerCountBand: "PLAYER_COUNT_MISMATCH",
          toCall: "CALL_BAND_MISMATCH",
        };
        const reason = axisReasonMap[row.isolationAxis];
        if (reason) nearReasons[reason] += 1;
      }
      continue;
    }

    if (row.sourceType === "verified-relaxed-match") {
      const relaxedAxes = Array.isArray(row.relaxedAxes) ? row.relaxedAxes : [];
      const relaxedAxisValues = row.relaxedAxisValues ?? {};
      const allMatch = relaxedAxes.every((axis) => {
        const wanted = relaxedAxisValues?.[axis];
        if (!Array.isArray(wanted) || !wanted.length) return false;
        return wanted.includes(String(context.axes?.[axis] ?? ""));
      });
      if (allMatch) exactRows.push(row);
      else if (relaxedAxes.includes("pressureChain")) nearReasons.PRESSURE_CHAIN_MISMATCH += 1;
    }
  }

  const scoredExactRows = exactRows
    .map((row) => ({
      row,
      specificity: bucketSpecificityScore(row),
    }))
    .sort((left, right) => {
      if (right.specificity.score !== left.specificity.score) return right.specificity.score - left.specificity.score;
      return Number(right.row.trainingWeight ?? 0) - Number(left.row.trainingWeight ?? 0);
    });
  const matchedRow = scoredExactRows[0]?.row ?? null;
  const nearOpportunityCount = Object.values(nearReasons).reduce((sum, count) => sum + Number(count ?? 0), 0);
  if (matchedRow) {
    const shadow = createShadowSourceAttribution({
      selectedRow: matchedRow,
      matchedRows: exactRows,
    });
    return {
      matchedRow,
      exactRows,
      sourcePriorityOrder: [...SOURCE_PRIORITY_ORDER],
      specificityScores: scoredExactRows.map((entry) => ({
        bucket: entry.row.bucket,
        sourceType: entry.row.sourceType,
        ...entry.specificity,
      })),
      shadowAttribution: shadow,
      fallbackReason: null,
      exactOpportunityCount: exactRows.length,
      nearOpportunityCount,
      nearReasons,
    };
  }
  const dominantNearReason = Object.entries(nearReasons).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "NO_MATCHING_STATE";
  return {
    matchedRow: null,
    exactRows,
    sourcePriorityOrder: [...SOURCE_PRIORITY_ORDER],
    specificityScores: [],
    shadowAttribution: createShadowSourceAttribution({
      selectedRow: null,
      matchedRows: exactRows,
    }),
    fallbackReason: nearOpportunityCount > 0 ? dominantNearReason : "NO_MATCHING_STATE",
    exactOpportunityCount: exactRows.length,
    nearOpportunityCount,
    nearReasons,
  };
}

export function buildBucketMatch({
  variantId,
  snapshot,
  seatIndex,
  legalActions = [],
  reconciliationOptions = {},
} = {}) {
  const hand = getActorHand(snapshot, seatIndex);
  const handClass = classifyHandClassForVariant(variantId, hand);
  const facingAction = getFacingAction(snapshot, seatIndex);
  const livePlayers = (snapshot?.players ?? []).filter(
    (player) => player && !player.folded && !player.hasFolded && !player.seatOut && !player.sittingOut,
  ).length;
  const position = deriveTablePositionLabel(snapshot, seatIndex);
  if (
    variantId === "S02" &&
    handClass === "lowerMediumSDA5" &&
    facingAction === "none" &&
    stackDepthFromSnapshot(snapshot, seatIndex) === "deep" &&
    [3, 4].includes(livePlayers) &&
    hasLegalActionType(legalActions, "RAISE") &&
    hasLegalActionType(legalActions, "CHECK")
  ) {
    return {
      bucket: `${STEP41_S02_DEEP_RAISE_CHECK_FAMILY} playerCount=${livePlayers}`,
      parentBucket: STEP41_S02_DEEP_RAISE_CHECK_FAMILY,
    };
  }
  if (
    variantId === "S02" &&
    handClass === "strongSDA5" &&
    facingAction !== "none" &&
    (
      reconciliationOptions?.replayCompatiblePlayercount ||
      reconciliationOptions?.replayCompatibleCallband ||
      reconciliationOptions?.replayCompatiblePressurechain
    )
  ) {
    const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
    const foldedPlayers = players.filter((player) => player?.folded || player?.hasFolded).length;
    const allInPlayers = players.filter((player) => player?.allIn).length;
    const potEligiblePlayers = players.filter((player) => Number(player?.betThisRound ?? player?.betThisStreet ?? player?.bet ?? 0) > 0).length;
    const bettingEligiblePlayers = players.filter((player) => {
      if (!player || player.folded || player.hasFolded || player.seatOut || player.sittingOut) return false;
      return Number(player?.betThisRound ?? player?.betThisStreet ?? player?.bet ?? 0) > 0;
    }).length;
    const playerCount = effectiveOpportunityPlayerCount({
      activePlayers: livePlayers,
      foldedPlayers,
      allInPlayers,
      bettingEligiblePlayers,
      potEligiblePlayers,
      replayCompatibleMode: Boolean(reconciliationOptions?.replayCompatiblePlayercount),
    });
    const playerCountBand = playerCount <= 2 ? "HU" : playerCount === 3 ? "3way" : "4way+";
    const positionBand = normalizeReplayCompatiblePositionBand(position);
    const toCall = getCurrentBet(snapshot, seatIndex);
    const callBand = reconciliationOptions?.replayCompatibleCallband
      ? replayCompatibleCallBand({
          toCall,
          pot: Number(snapshot?.pot ?? snapshot?.metadata?.pot ?? 0) || 0,
          stack: Number(snapshot?.players?.[seatIndex]?.stack ?? 0) || 0,
          limitUnit: Number(snapshot?.bigBlind ?? 20) || 20,
          street: Number(snapshot?.drawRound ?? snapshot?.metadata?.drawRound ?? 0) || 0,
          variantId,
        })
      : null;
    const rawPressureChain = classifyS02V3IsolationAxes({
      actorSeat: seatIndex,
      position,
      drawRound: snapshot?.drawRound ?? snapshot?.metadata?.drawRound ?? 0,
      legalActions,
      state: { snapshot },
      facingAction,
    }).pressureChain;
    const pressure = reconciliationOptions?.replayCompatiblePressurechain
      ? replayCompatiblePressureChain({
          pressureChain: rawPressureChain,
          repeatedPressure: String(facingAction).toLowerCase() === "raise" ? "repeated" : "single",
        })
      : null;
    if (
      playerCountBand === "3way" &&
      positionBand === "IP" &&
      callBand === "small" &&
      pressure?.repeatedPressure === "repeated" &&
      ["firstRaiseAfterCall", "repeatedPressure"].includes(String(pressure?.pressureChain ?? ""))
    ) {
      return { bucket: STEP14_S02_TARGET_BUCKET, parentBucket: STEP14_S02_TARGET_BUCKET };
    }
  }
  const classified = classifyStableNeighborContext({
    variantId,
    handClass,
    facingAction,
    playerCount: livePlayers,
    position,
    legalActions,
    snapshot,
    actorSeat: seatIndex,
  });
  if (classified) {
    return {
      bucket: classified.subBucketId,
      parentBucket: classified.parentStableBucket,
    };
  }

  if (variantId === "D02" && handClass === "strongA5" && facingAction === "raise") {
    return { bucket: "strongA5 second-pressure", parentBucket: "strongA5 second-pressure" };
  }
  if (variantId === "S01" && handClass === "strongSD27" && facingAction !== "none") {
    return { bucket: "strongSD27 top-end pressure", parentBucket: "strongSD27 top-end pressure" };
  }
  if (variantId === "S02" && handClass === "strongSDA5" && facingAction !== "none") {
    return { bucket: "strongSDA5 CALL/FOLD/RAISE", parentBucket: "strongSDA5 CALL/FOLD/RAISE" };
  }
  return null;
}

function aggregateDatasetChoices(rows = []) {
  const byBucket = new Map();
  for (const row of rows) {
    const key = `${row.variantId}|${row.bucket}`;
    if (!byBucket.has(key)) {
      byBucket.set(key, {
        variantId: row.variantId,
        bucket: row.bucket,
        actionWeights: new Map(),
        totalRows: 0,
        sourceType: row.sourceType ?? row.metadata?.sourceType ?? "stable-bucket",
        parentStableBucket: row.parentStableBucket ?? row.metadata?.parentStableBucket ?? row.bucket,
        neighborAxis: row.neighborAxis ?? row.metadata?.neighborAxis ?? null,
      });
    }
    const aggregate = byBucket.get(key);
    const actionType = String(row?.chosenBestAction?.type ?? "").toUpperCase();
    if (!actionType) continue;
    const weight = Number(row.trainingWeight ?? 1) || 1;
    aggregate.totalRows += 1;
    aggregate.actionWeights.set(actionType, (aggregate.actionWeights.get(actionType) ?? 0) + weight);
  }
  const resolved = new Map();
  for (const [key, aggregate] of byBucket.entries()) {
    const [chosenActionType, chosenWeight] = [...aggregate.actionWeights.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!chosenActionType) continue;
    resolved.set(key, {
      variantId: aggregate.variantId,
      bucket: aggregate.bucket,
      actionType: chosenActionType,
      weight: Number(chosenWeight ?? 0),
      totalRows: aggregate.totalRows,
      sourceType: aggregate.sourceType,
      parentStableBucket: aggregate.parentStableBucket,
      neighborAxis: aggregate.neighborAxis,
    });
  }
  return resolved;
}

export async function loadIronCandidatePolicyDataset(datasetPath) {
  const loaded = await loadActionValueDataset(datasetPath);
  return {
    datasetPath,
    loaded,
    bucketIndex: aggregateDatasetChoices(loaded.validRows),
    specializedRows: buildSpecializedMatchIndexes(loaded.validRows),
  };
}

export async function createIronCandidatePolicy({
  datasetPath,
  loadedDataset = null,
  reconciliationOptions = {},
} = {}) {
  const resolved = loadedDataset ?? (await loadIronCandidatePolicyDataset(datasetPath));
  const bucketIndex = resolved.bucketIndex;
  const specializedRows = resolved.specializedRows ?? [];

  return {
    datasetPath,
    promoted: false,
    specializedRows,
    async chooseAction({
      variantId,
      snapshot,
      seatIndex,
      legalActions,
      fallbackDecisionFactory,
    } = {}) {
      const bucket = buildBucketMatch({
        variantId,
        snapshot,
        seatIndex,
        legalActions,
        reconciliationOptions,
      });
      const legalTypes = legalActionTypeSet(legalActions);
      const specializedContext = createS02OpportunityContext({ snapshot, seatIndex, legalActions, bucket });
      const specializedMatch = variantId === "S02"
        ? evaluateSpecializedS02Match({ rows: specializedRows, context: specializedContext })
        : { matchedRow: null, fallbackReason: null, exactOpportunityCount: 0, nearOpportunityCount: 0 };
      if (bucket) {
        const exactSpecializedAggregate = specializedMatch?.matchedRow
          ? {
              variantId,
              bucket: specializedMatch.matchedRow.bucket,
              actionType: String(specializedMatch.matchedRow?.chosenBestAction?.type ?? "").toUpperCase(),
              weight: Number(specializedMatch.matchedRow?.trainingWeight ?? 0),
              totalRows: 1,
              sourceType: specializedMatch.matchedRow.sourceType,
              parentStableBucket: specializedMatch.matchedRow.parentStableBucket,
              neighborAxis: specializedMatch.matchedRow.neighborAxis ?? specializedMatch.matchedRow.isolationAxis ?? null,
            }
          : null;
        const exactMatch = bucketIndex.get(`${variantId}|${bucket.bucket}`) ?? null;
        const parentMatch = bucketIndex.get(`${variantId}|${bucket.parentBucket}`) ?? null;
        const match = exactSpecializedAggregate ?? exactMatch ?? parentMatch;
        if (match && legalTypes.has(match.actionType)) {
          return {
            type: match.actionType,
            amount: 0,
            discardIndexes: [],
            source: "iron-dryrun-dataset",
            reason: `dataset:${match.bucket}`,
            confidence: 0.9,
            metadata: {
              decisionSource: "iron-dryrun-dataset",
              decisionReason: `dataset:${match.bucket}`,
              ironDryRunMatched: true,
              ironDryRunFallback: false,
              ironDryRunFallbackReason: null,
              candidateBucket: bucket.bucket,
              candidateParentBucket: bucket.parentBucket,
              matchedBucket: match.bucket,
              matchedSourceType: match.sourceType,
              parentStableBucket: match.parentStableBucket,
              neighborAxis: match.neighborAxis,
              exactOpportunityCount: specializedMatch.exactOpportunityCount ?? 0,
              nearOpportunityCount: specializedMatch.nearOpportunityCount ?? 0,
              sourcePriorityOrder: specializedMatch.sourcePriorityOrder ?? [],
              shadowSourceAttribution: specializedMatch.shadowAttribution ?? null,
              sourceSpecificityScores: specializedMatch.specificityScores ?? [],
              reconciledMatcher:
                Boolean(reconciliationOptions?.replayCompatiblePlayercount) ||
                Boolean(reconciliationOptions?.replayCompatibleCallband) ||
                Boolean(reconciliationOptions?.replayCompatiblePressurechain),
              promoted: false,
            },
          };
        }
      }

      const fallbackDecision = typeof fallbackDecisionFactory === "function"
        ? await fallbackDecisionFactory()
        : null;
      if (fallbackDecision) {
        return {
          ...fallbackDecision,
          metadata: {
            ...(fallbackDecision.metadata ?? {}),
            ironDryRunMatched: false,
            ironDryRunFallback: true,
            ironDryRunFallbackReason: specializedMatch?.matchedRow
              ? "ACTION_ILLEGAL"
              : specializedMatch?.fallbackReason
                ? specializedMatch.fallbackReason
                : bucket
                  ? bucketIndex.get(`${variantId}|${bucket.bucket}`)
                    ? "action-illegal"
                    : bucketIndex.get(`${variantId}|${bucket.parentBucket}`)
                      ? "bucket-mismatch"
                      : "no-dataset-match"
                  : "no-matching-state",
            candidateBucket: bucket?.bucket ?? null,
            candidateParentBucket: bucket?.parentBucket ?? null,
            matchedBucket: bucket?.bucket ?? bucket?.parentBucket ?? null,
            matchedSourceType: null,
            exactOpportunityCount: specializedMatch?.exactOpportunityCount ?? 0,
            nearOpportunityCount: specializedMatch?.nearOpportunityCount ?? 0,
            nearOpportunityReasons: specializedMatch?.nearReasons ?? {},
            sourcePriorityOrder: specializedMatch?.sourcePriorityOrder ?? [],
            shadowSourceAttribution: specializedMatch?.shadowAttribution ?? null,
            sourceSpecificityScores: specializedMatch?.specificityScores ?? [],
            reconciledMatcher:
              Boolean(reconciliationOptions?.replayCompatiblePlayercount) ||
              Boolean(reconciliationOptions?.replayCompatibleCallband) ||
              Boolean(reconciliationOptions?.replayCompatiblePressurechain),
            promoted: false,
          },
        };
      }
      return null;
    },
  };
}
