import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import tiers from "../../config/ai/tiers.json" with { type: "json" };
import { buildAiContext, computeDrawDecision } from "../policyRouter.js";
import { chooseProAction } from "../pro/proDecisionOverlay.js";
import { evaluateBadugi } from "../../games/badugi/utils/badugiEvaluator.js";
import { evaluateLowHand } from "../../games/evaluators/low.js";
import { validateHandEvIntegrity } from "../../games/testing/ev/evIntegrityChecker.js";
import { getActorIndex } from "../../games/testing/progress/gameProgressInvariants.js";
import { chooseSafeAction } from "../../games/testing/scenario/safeActionPolicy.js";
import { BadugiGameController } from "../../games/badugi/controller/BadugiGameController.js";
import { DeuceToSevenTripleDrawController } from "../../games/draw/DeuceToSevenTripleDrawController.js";
import { AceToFiveTripleDrawController } from "../../games/draw/AceToFiveTripleDrawController.js";
import { DeuceToSevenSingleDrawController } from "../../games/draw/DeuceToSevenSingleDrawController.js";
import { AceToFiveSingleDrawController } from "../../games/draw/AceToFiveSingleDrawController.js";
import { analyzeActionDivergence } from "./analyzeActionDivergence.js";
import { bucketForReplaySample, matchesReplayBucketFilter } from "./counterfactualBuckets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AI_EVAL_REPORT_DIR = path.resolve(__dirname, "../../../reports/ai-eval");
export const AI_EVAL_DIVERGENCE_REPLAY_DIR = path.resolve(
  __dirname,
  "../../../reports/ai-eval/divergence-replay-samples",
);

const DEFAULT_HANDS = 40;
const DEFAULT_PLAYER_COUNT = 6;
const DEFAULT_MAX_STEPS = 300;
const DEFAULT_MAX_DIVERGENCE_RECORDS = 600;
const DEFAULT_MAX_REPLAY_SAMPLES = 400;
const TIER_MAP = new Map(tiers.map((tier) => [tier.id, Object.freeze(tier)]));

const DRAW_VARIANT_CONTROLLERS = {
  D01: DeuceToSevenTripleDrawController,
  D02: AceToFiveTripleDrawController,
  S01: DeuceToSevenSingleDrawController,
  S02: AceToFiveSingleDrawController,
};

const MAJOR_10_VARIANTS = ["D03", "D01", "D02", "S01", "S02", "B01", "B05", "B06", "ST1", "ST3"];
const SUPPORTED_VARIANTS = new Set(["D03", "D01", "D02", "S01", "S02"]);
const NOT_RUN_REASONS = {
  B01: "NEEDS_PRO_RULES",
  B05: "NEEDS_PRO_RULES",
  B06: "NEEDS_PRO_RULES",
  ST1: "NEEDS_PRO_RULES",
  ST3: "NEEDS_PRO_RULES",
};
const BIG_BLIND_BY_VARIANT = {
  D03: 10,
  D01: 20,
  D02: 20,
  S01: 20,
  S02: 20,
};

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
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

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function normalizeDivergenceOptions(options = {}) {
  return {
    captureDivergence:
      options.captureDivergence == null ? true : Boolean(options.captureDivergence),
    maxDivergenceRecords: Math.max(
      0,
      toNumber(options.maxDivergenceRecords, DEFAULT_MAX_DIVERGENCE_RECORDS),
    ),
    maxReplaySamples: Math.max(
      0,
      toNumber(options.maxReplaySamples ?? options.maxDivergenceSamples, DEFAULT_MAX_REPLAY_SAMPLES),
    ),
    divergenceSampleTag: String(options.divergenceSampleTag ?? "").trim() || null,
    divergenceBucketFilter: Array.isArray(options.divergenceBucketFilter)
      ? options.divergenceBucketFilter
      : typeof options.divergenceBucketFilter === "string" && options.divergenceBucketFilter.trim().length
        ? options.divergenceBucketFilter.split(",").map((entry) => entry.trim()).filter(Boolean)
        : [],
    bucketSampleLimit: Math.max(0, toNumber(options.bucketSampleLimit ?? 0, 0)),
    variantSampleLimit: Math.max(0, toNumber(options.variantSampleLimit ?? 0, 0)),
    handClassSampleLimit: Math.max(0, toNumber(options.handClassSampleLimit ?? 0, 0)),
  };
}

function canStoreReplaySample(sample, analysis = {}, divergenceOptions = {}) {
  if (!divergenceOptions.captureDivergence) return false;
  if (!matchesReplayBucketFilter(sample, divergenceOptions.divergenceBucketFilter)) return false;
  if ((analysis.divergenceReplaySamples?.length ?? 0) >= divergenceOptions.maxReplaySamples) return false;
  if (divergenceOptions.variantSampleLimit > 0) {
    const variantCount = (analysis.divergenceReplaySamples ?? []).filter(
      (entry) => entry.variantId === sample.variantId,
    ).length;
    if (variantCount >= divergenceOptions.variantSampleLimit) return false;
  }
  if (divergenceOptions.handClassSampleLimit > 0) {
    const handClassCount = (analysis.divergenceReplaySamples ?? []).filter(
      (entry) => entry.variantId === sample.variantId && entry.handClass === sample.handClass,
    ).length;
    if (handClassCount >= divergenceOptions.handClassSampleLimit) return false;
  }
  if (divergenceOptions.bucketSampleLimit > 0) {
    const bucket = bucketForReplaySample(sample);
    const bucketCount = (analysis.divergenceReplaySamples ?? []).filter(
      (entry) => entry.variantId === sample.variantId && bucketForReplaySample(entry) === bucket,
    ).length;
    if (bucketCount >= divergenceOptions.bucketSampleLimit) return false;
  }
  return true;
}

function buildAlternatingSeatAssignments(playerCount = DEFAULT_PLAYER_COUNT) {
  return Array.from({ length: playerCount }, (_, seat) => ({
    seat,
    tier: seat % 2 === 0 ? "pro" : "standard",
  }));
}

function mirrorSeatAssignments(assignments = []) {
  return assignments.map((entry) => ({
    seat: entry.seat,
    tier: entry.tier === "pro" ? "standard" : "pro",
  }));
}

function normalizeSeatAssignments(seatAssignments = null, playerCount = DEFAULT_PLAYER_COUNT) {
  const primary = Array.isArray(seatAssignments) && seatAssignments.length
    ? seatAssignments.map((entry, seat) => ({
        seat: Number(entry?.seat ?? seat),
        tier: String(entry?.tier ?? "standard").toLowerCase() === "pro" ? "pro" : "standard",
      }))
    : buildAlternatingSeatAssignments(playerCount);
  return {
    primary,
    mirrored: mirrorSeatAssignments(primary),
  };
}

function getSeatTier(assignments = [], seatIndex) {
  return assignments.find((entry) => entry.seat === seatIndex)?.tier ?? "standard";
}

function getHand(snapshot = {}, seatIndex = 0) {
  const player = snapshot?.players?.[seatIndex] ?? {};
  const hand = player.hand ?? player.cards ?? player.holeCards ?? [];
  return Array.isArray(hand) ? [...hand] : [];
}

function getCurrentBet(snapshot = {}, seatIndex = 0) {
  const player = snapshot?.players?.[seatIndex] ?? {};
  const currentBet = toNumber(snapshot?.currentBet ?? snapshot?.metadata?.currentBet, 0);
  const playerBet = toNumber(player?.betThisRound ?? player?.betThisStreet ?? player?.bet, 0);
  return Math.max(0, currentBet - playerBet);
}

function getDrawRoundIndex(snapshot = {}) {
  return toNumber(snapshot?.drawRoundIndex ?? snapshot?.drawRound, 0);
}

function getBettingRoundIndex(snapshot = {}) {
  return toNumber(
    snapshot?.bettingRoundIndex ??
      snapshot?.metadata?.bettingRoundIndex ??
      snapshot?.streetIndex ??
      snapshot?.roundIndex,
    0,
  );
}

function getPositionLabel(snapshot = {}, seatIndex = 0) {
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  const playerCount = players.length;
  if (playerCount <= 1) return "unknown";
  const buttonIndex = toNumber(
    snapshot?.buttonIndex ?? snapshot?.dealerIndex ?? snapshot?.metadata?.buttonIndex,
    -1,
  );
  if (buttonIndex < 0) return "unknown";
  const relative = (seatIndex - buttonIndex + playerCount) % playerCount;
  if (relative === 0) return "button";
  if (relative === 1) return "small-blind";
  if (relative === 2) return "big-blind";
  if (relative === playerCount - 1) return "cutoff";
  return relative <= Math.floor(playerCount / 2) ? "early" : "late";
}

function getFacingAction(snapshot = {}, seatIndex = 0) {
  const toCall = getCurrentBet(snapshot, seatIndex);
  if (toCall <= 0) return "none";
  const raiseCountThisRound = toNumber(
    snapshot?.metadata?.raiseCountThisRound ?? snapshot?.raiseCountThisRound,
    0,
  );
  return raiseCountThisRound > 0 ? "raise" : "bet";
}

function hasLegalAction(legalActions = [], target) {
  const wanted = String(target ?? "").toUpperCase();
  return legalActions.some((action) => String(action?.type ?? action).toUpperCase() === wanted);
}

function normalizeActionType(action = null) {
  return String(action?.type ?? action?.action ?? "").toUpperCase();
}

function toKebabCase(value = "") {
  return String(value ?? "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function countWinners(snapshot = {}) {
  if (Array.isArray(snapshot?.lastHandResult?.winners)) {
    return snapshot.lastHandResult.winners
      .map((winner) => Number(winner?.seatIndex ?? winner?.seat))
      .filter(Number.isInteger);
  }
  if (Array.isArray(snapshot?.lastHandResult?.results)) {
    return snapshot.lastHandResult.results.flatMap((result) =>
      (result?.payouts ?? result?.winners ?? [])
        .map((winner) => Number(winner?.seatIndex ?? winner?.seat))
        .filter(Number.isInteger),
    );
  }
  return [];
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

function isEvaluationTerminal(controller, state, snapshot = {}) {
  const phase = String(snapshot?.phase ?? snapshot?.street ?? "").toUpperCase();
  if (snapshot?.lastHandResult || phase === "SHOWDOWN" || phase === "HAND_RESULT") {
    return true;
  }
  if (typeof controller?.isHandFinished === "function" && controller.isHandFinished(state)) {
    return true;
  }
  return countLivePlayers(snapshot) <= 1;
}

function getFinalPot(snapshot = {}) {
  if (typeof snapshot?.pot === "number") return snapshot.pot;
  if (Array.isArray(snapshot?.pots)) {
    return snapshot.pots.reduce((sum, pot) => sum + Math.max(0, toNumber(pot?.amount ?? pot?.potAmount)), 0);
  }
  return 0;
}

function getPotSize(snapshot = {}) {
  if (typeof snapshot?.pot === "number") return Math.max(0, snapshot.pot);
  if (Array.isArray(snapshot?.pots) && snapshot.pots.length) {
    return snapshot.pots.reduce((sum, pot) => sum + Math.max(0, toNumber(pot?.amount ?? pot?.potAmount)), 0);
  }
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  const currentBet = toNumber(snapshot?.currentBet ?? snapshot?.metadata?.currentBet, 0);
  if (!players.length || currentBet <= 0) return 0;
  return currentBet * players.length;
}

function classifyBetSizeBucket(toCall = 0, potSize = 0) {
  const normalizedPot = Math.max(1, potSize);
  const ratio = toCall / normalizedPot;
  if (ratio > 1) return "large";
  if (ratio > 0.5) return "large";
  if (ratio > 0.2) return "medium";
  return "small";
}

function chooseTierConfig(tierId = "standard") {
  return TIER_MAP.get(tierId) ?? TIER_MAP.get("standard") ?? { id: "standard" };
}

function classifyActionSource(source = "", tier = "standard") {
  const normalized = String(source ?? "").toLowerCase();
  if (normalized === "pro-overlay") return "pro-overlay";
  if (normalized === "onnx") return "onnx";
  if (normalized === "safe-fallback") return "safe-fallback";
  if (normalized === "standard-rule" || tier === "standard") return "standard-rule";
  return "standard-rule";
}

function createCpuSeatConfig(playerCount) {
  return Array.from({ length: playerCount }, () => "CPU");
}

function createControllerForVariant(variantId, playerCount = DEFAULT_PLAYER_COUNT) {
  const seatConfig = createCpuSeatConfig(playerCount);
  if (variantId === "D03") {
    return new BadugiGameController({
      numSeats: playerCount,
      seatConfig,
      startingStack: 500,
      blindStructure: [{ sb: 5, bb: 10, ante: 0 }],
    });
  }
  const Controller = DRAW_VARIANT_CONTROLLERS[variantId];
  if (!Controller) {
    return null;
  }
  return new Controller({
    tableConfig: {
      seatConfig,
      startingStack: 500,
      structure: { sb: 10, bb: 20, ante: 0 },
    },
  });
}

function createInitialHandState(controller, variantId, playerCount = DEFAULT_PLAYER_COUNT) {
  const seatConfig = createCpuSeatConfig(playerCount);
  if (variantId === "D03") {
    const initial = controller.createInitialState();
    return controller.createNewHandState(initial, {
      seatConfig,
      startingStack: 500,
      blindStructure: [{ sb: 5, bb: 10, ante: 0 }],
    });
  }
  const initial = controller.createInitialState();
  return controller.createNewHandState(initial, {
    seatConfig,
    startingStack: 500,
    structure: { sb: 10, bb: 20, ante: 0 },
  });
}

function buildActionPayload({ seatIndex, decision = {}, tierId = "standard", currentBetAmount = 0 }) {
  const type = normalizeActionType(decision);
  const payloadType = String(decision?.payload?.type ?? decision?.action ?? type.toLowerCase()).toLowerCase();
  const amount =
    type === "CALL" && !toNumber(decision?.amount, 0)
      ? currentBetAmount
      : toNumber(decision?.amount, 0);
  return {
    seatIndex,
    type,
    amount,
    discardIndexes: Array.isArray(decision?.discardIndexes) ? [...decision.discardIndexes] : [],
    payload: {
      type: payloadType,
      amount,
      discardIndexes: Array.isArray(decision?.discardIndexes) ? [...decision.discardIndexes] : [],
      drawIndexes: Array.isArray(decision?.discardIndexes) ? [...decision.discardIndexes] : [],
      drawCount: Array.isArray(decision?.discardIndexes) ? decision.discardIndexes.length : 0,
    },
    metadata: {
      ...(decision?.metadata ?? {}),
      type: payloadType,
      tierId,
      decisionSource:
        decision?.metadata?.decisionSource ??
        decision?.source ??
        (tierId === "pro" ? "pro-overlay" : "standard-rule"),
      decisionReason:
        decision?.metadata?.decisionReason ??
        decision?.reason ??
        decision?.metadata?.raiseReason ??
        "evaluation-decision",
      confidence: decision?.confidence ?? decision?.metadata?.confidence ?? null,
      fallbackReasonCategory:
        decision?.metadata?.fallbackReasonCategory ?? decision?.fallbackReasonCategory ?? null,
      discardIndexes: Array.isArray(decision?.discardIndexes) ? [...decision.discardIndexes] : [],
      warnings: Array.isArray(decision?.metadata?.warnings)
        ? [...decision.metadata.warnings]
        : Array.isArray(decision?.warnings)
          ? [...decision.warnings]
          : [],
    },
  };
}

function buildBadugiDecision({ snapshot, legalActions, seatIndex, tierId }) {
  const hand = getHand(snapshot, seatIndex);
  const actor = snapshot?.players?.[seatIndex] ?? {};
  const tierConfig = chooseTierConfig(tierId);
  const context = buildAiContext({
    variantId: "D03",
    tierConfig,
    opponentStats: {},
  });
  const evaluation = evaluateBadugi(hand);
  if (String(snapshot?.phase ?? snapshot?.street ?? "").toUpperCase() === "DRAW") {
    const standardDrawDecision = computeDrawDecision({
      context,
      evaluation,
      hand,
    });
    if (tierId !== "pro") {
      return {
        type: "DRAW",
        discardIndexes: standardDrawDecision.discardIndexes ?? [],
        source: "standard-rule",
        reason: standardDrawDecision.source ?? "policy-router",
        confidence: 0.55,
      };
    }
    return chooseProAction({
      variantId: "D03",
      family: "badugi",
      snapshot: {
        ...snapshot,
        phase: "DRAW",
        street: "DRAW",
        maxDiscardCount: hand.length,
        actingPlayerIndex: seatIndex,
      },
      legalActions,
      standardAction: {
        type: "DRAW",
        discardIndexes: standardDrawDecision.discardIndexes ?? [],
        confidence: 0.55,
        reason: standardDrawDecision.source ?? "policy-router",
      },
      context: { actor },
    });
  }

  const safeDecision = chooseSafeAction({
    snapshot,
    legalActions,
    family: "draw",
  });
  const standardAction = {
    type: safeDecision.type,
    amount: safeDecision.amount ?? 0,
    confidence: 0.45,
    reason: "evaluation-safe-badugi-bet",
  };
  if (tierId !== "pro") {
    return {
      ...standardAction,
      source: "standard-rule",
    };
  }
  return chooseProAction({
    variantId: "D03",
    family: "badugi",
    snapshot: {
      ...snapshot,
      phase: "BET",
      street: "BET",
      actingPlayerIndex: seatIndex,
    },
    legalActions,
    standardAction,
    context: { actor },
  });
}

function summarizeHandFeatures({ variantId, hand = [] }) {
  if (variantId === "D03") {
    const evaluation = evaluateBadugi(hand);
    return {
      family: "badugi",
      hand,
      madeCount: evaluation.count,
      kicker: evaluation.kicker,
    };
  }
  const lowType = ["D02", "S02"].includes(variantId) ? "A5" : "27";
  const evaluation = evaluateLowHand({ cards: hand, lowType });
  const ranks = evaluation?.metadata?.ranks ?? [];
  return {
    family: lowType,
    hand,
    category: evaluation?.metadata?.category ?? null,
    highestRank: ranks[0] ?? null,
    ranks,
    paired: new Set(ranks.map(Number)).size < ranks.length,
  };
}

function analyzeLowTextureForEvaluation(ranks = [], lowType = "27") {
  const ordered = [...ranks].map((rank) => Number(rank) || 99).sort((left, right) => left - right);
  const highest = ordered[ordered.length - 1] ?? 99;
  const secondHighest = ordered[ordered.length - 2] ?? 99;
  const largestGap = ordered.slice(1).reduce((gap, rank, index) => Math.max(gap, rank - ordered[index]), 0);
  const smoothHigh = lowType === "A5" ? 7 : 8;
  const isSmooth =
    highest <= smoothHigh &&
    secondHighest <= (lowType === "A5" ? 5 : 6) &&
    largestGap <= 2;
  const isRough =
    highest >= (lowType === "A5" ? 8 : 9) ||
    secondHighest >= (lowType === "A5" ? 6 : 7) ||
    largestGap >= 4;
  return { highest, secondHighest, largestGap, isSmooth, isRough };
}

function classifyD02HandClass(hand = []) {
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
  const texture = analyzeLowTextureForEvaluation(ranks, "A5");
  if (paired || !cleanLow) {
    if (highestRank >= 10 || paired) return "trashA5";
    return "weakA5";
  }
  if (highestRank <= 6) return "premiumA5";
  if (highestRank === 7 && texture.isSmooth) return "strongA5";
  if ((highestRank === 7 && !texture.isRough) || (highestRank === 8 && texture.isSmooth)) {
    return "mediumA5";
  }
  if (highestRank <= 9) return "weakA5";
  return "trashA5";
}

function classifyD01HandClass(hand = []) {
  const evaluation = evaluateLowHand({ cards: hand, lowType: "27" });
  const ranks = evaluation?.metadata?.ranks ?? [];
  const paired = new Set(ranks.map(Number)).size < ranks.length;
  const highestRank = ranks[0] ?? 99;
  const category = String(evaluation?.metadata?.category ?? "");
  const texture = analyzeLowTextureForEvaluation(ranks, "27");
  if (paired || ["pair", "straight", "flush", "straightFlush"].includes(category)) return "trash27TD";
  if (highestRank <= 7) return "premium27TD";
  if (highestRank === 8) return texture.isSmooth ? "premium27TD" : "strong27TD";
  if (highestRank === 9) return "medium27TD";
  if (highestRank === 10) return "medium27TD";
  if (highestRank <= 12) return "weak27TD";
  return "trash27TD";
}

function classifyS01HandClass(hand = []) {
  const evaluation = evaluateLowHand({ cards: hand, lowType: "27" });
  const ranks = evaluation?.metadata?.ranks ?? [];
  const paired = new Set(ranks.map(Number)).size < ranks.length;
  const highestRank = ranks[0] ?? 99;
  const category = String(evaluation?.metadata?.category ?? "");
  const texture = analyzeLowTextureForEvaluation(ranks, "27");
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

function classifyS02HandClass(hand = []) {
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
  const texture = analyzeLowTextureForEvaluation(ranks, "A5");
  if (paired || !cleanLow) return highestRank >= 10 || paired ? "trashSDA5" : "weakSDA5";
  if (highestRank <= 6) return "premiumSDA5";
  if (highestRank === 7) return texture.isRough ? "strongSDA5" : "strongSDA5";
  if (highestRank === 8) {
    return (texture.secondHighest ?? 99) <= 4 && (texture.largestGap ?? 99) <= 3
      ? "upperMediumSDA5"
      : "lowerMediumSDA5";
  }
  if (highestRank <= 10) return "weakSDA5";
  return "trashSDA5";
}

function classifyHandClassForVariant(variantId, hand = []) {
  switch (variantId) {
    case "D02":
      return classifyD02HandClass(hand);
    case "D01":
      return classifyD01HandClass(hand);
    case "S01":
      return classifyS01HandClass(hand);
    case "S02":
      return classifyS02HandClass(hand);
    case "D03": {
      const evaluation = evaluateBadugi(hand);
      if (evaluation.count >= 4) return "madeBadugi";
      if (evaluation.count === 3) return "threeCardBadugi";
      return "weakBadugi";
    }
    default:
      return "unknown";
  }
}

function finalizeHandResult({ beforeSnapshot, snapshot, metrics, variantId, handIndex, trace }) {
  const evCheck = validateHandEvIntegrity({
    beforeState: beforeSnapshot,
    afterState: snapshot,
    result: snapshot.lastHandResult ?? snapshot.result ?? snapshot.results ?? null,
    variant: { id: variantId },
    options: {
      allowMissingResult: true,
      allowResultPotEcho: true,
      enforceZeroSumReward: false,
    },
  });
  metrics.evFailure = !evCheck.ok;
  metrics.winners = countWinners(snapshot);
  metrics.finalPot = getFinalPot(snapshot);
  (snapshot.players ?? []).forEach((player, seatIndex) => {
    metrics.seatDeltas[seatIndex] = toNumber(player?.stack, 0) - toNumber(beforeSnapshot?.players?.[seatIndex]?.stack, 0);
  });
  metrics.callEvents = (metrics.callEvents ?? []).map((event) => ({
    ...event,
    seatDelta: metrics.seatDeltas[event.seatIndex] ?? 0,
    losingCall: (metrics.seatDeltas[event.seatIndex] ?? 0) < 0,
  }));
  metrics.divergenceRecords = (metrics.divergenceRecords ?? []).map((event) => {
    const seatDelta = metrics.seatDeltas[event.seatIndex] ?? 0;
    const winner = metrics.winners.includes(event.seatIndex);
    return {
      ...event,
      proEvDelta: event.actualTier === "pro" ? seatDelta : null,
      standardEvDelta: event.actualTier === "standard" ? seatDelta : null,
      showdownResult: winner ? "win" : seatDelta > 0 ? "profit" : seatDelta < 0 ? "loss" : "neutral",
    };
  });
  return {
    status: evCheck.ok ? "PASS" : "FAIL",
    handIndex,
    trace,
    metrics,
    snapshot,
    ev: {
      ok: evCheck.ok,
      errors: evCheck.errors,
      warnings: evCheck.warnings,
      metrics: evCheck.metrics,
    },
  };
}

function decideAction({ controller, variantId, state, seatIndex, tierId }) {
  if (variantId === "D03") {
    const snapshot = state?.snapshot ?? controller.getUiSnapshot(state);
    const legalActions = controller.getLegalActions(state, seatIndex);
    return buildBadugiDecision({ snapshot, legalActions, seatIndex, tierId });
  }
  return controller.getCpuAction(state, seatIndex, {
    tierConfig: chooseTierConfig(tierId),
  });
}

function buildDivergenceRecord({
  variantId,
  seed,
  handIndex,
  step,
  snapshot,
  seatIndex,
  legalActions,
  hand,
  proDecision,
  standardDecision,
  actualTier,
  actualActionType,
}) {
  const proActionType = normalizeActionType(proDecision);
  const standardActionType = normalizeActionType(standardDecision);
  if (!proActionType || !standardActionType || proActionType === standardActionType) return null;
  const livePlayers = countLivePlayers(snapshot);
  return {
    variantId,
    seed,
    handId: handIndex,
    step,
    seatIndex,
    drawRound: getDrawRoundIndex(snapshot),
    bettingRound: getBettingRoundIndex(snapshot),
    playerCount: livePlayers,
    position: getPositionLabel(snapshot, seatIndex),
    potSize: getPotSize(snapshot),
    facingAction: getFacingAction(snapshot, seatIndex),
    handClass: classifyHandClassForVariant(variantId, hand),
    drawTexture: summarizeHandFeatures({ variantId, hand }),
    legalActions: legalActions.map((action) => String(action?.type ?? action)),
    actualTier,
    actualAction: actualActionType,
    proAction: proActionType,
    standardAction: standardActionType,
    proReason:
      proDecision?.metadata?.decisionReason ?? proDecision?.reason ?? proDecision?.metadata?.raiseReason ?? null,
    standardReason:
      standardDecision?.metadata?.decisionReason ??
      standardDecision?.reason ??
      standardDecision?.metadata?.raiseReason ??
      null,
    proSource: classifyActionSource(proDecision?.metadata?.decisionSource ?? proDecision?.source, "pro"),
    standardSource: classifyActionSource(
      standardDecision?.metadata?.decisionSource ?? standardDecision?.source,
      "standard",
    ),
    proEvDelta: actualTier === "pro" ? 0 : null,
    standardEvDelta: actualTier === "standard" ? 0 : null,
    evGap: null,
    showdownResult: null,
  };
}

function buildReplaySample({
  variantId,
  seed,
  handIndex,
  step,
  state,
  snapshot,
  seatIndex,
  legalActions,
  hand,
  proDecision,
  standardDecision,
}) {
  return {
    variantId,
    seed,
    handId: handIndex,
    step,
    actorSeat: seatIndex,
    drawRound: getDrawRoundIndex(snapshot),
    bettingRound: getBettingRoundIndex(snapshot),
    playerCount: countLivePlayers(snapshot),
    position: getPositionLabel(snapshot, seatIndex),
    facingAction: getFacingAction(snapshot, seatIndex),
    handClass: classifyHandClassForVariant(variantId, hand),
    potSize: getPotSize(snapshot),
    legalActions: legalActions.map((action) => String(action?.type ?? action)),
    stacks: (snapshot?.players ?? []).map((player, index) => ({
      seatIndex: index,
      stack: toNumber(player?.stack, 0),
      folded: Boolean(player?.folded || player?.hasFolded),
      allIn: Boolean(player?.allIn || player?.isAllIn),
    })),
    proAction: {
      type: normalizeActionType(proDecision),
      amount: toNumber(proDecision?.amount, 0),
      discardIndexes: Array.isArray(proDecision?.discardIndexes) ? [...proDecision.discardIndexes] : [],
      source: classifyActionSource(proDecision?.metadata?.decisionSource ?? proDecision?.source, "pro"),
      reason:
        proDecision?.metadata?.decisionReason ?? proDecision?.reason ?? proDecision?.metadata?.raiseReason ?? null,
    },
    standardAction: {
      type: normalizeActionType(standardDecision),
      amount: toNumber(standardDecision?.amount, 0),
      discardIndexes: Array.isArray(standardDecision?.discardIndexes)
        ? [...standardDecision.discardIndexes]
        : [],
      source: classifyActionSource(
        standardDecision?.metadata?.decisionSource ?? standardDecision?.source,
        "standard",
      ),
      reason:
        standardDecision?.metadata?.decisionReason ??
        standardDecision?.reason ??
        standardDecision?.metadata?.raiseReason ??
        null,
    },
    snapshot: clone(snapshot),
    state: clone(state),
  };
}

function evaluateDrawMistake({ variantId, phase, actionType, discardIndexes = [], hand = [] }) {
  if (phase !== "DRAW") return 0;
  if (variantId === "D03") {
    const evaluation = evaluateBadugi(hand);
    return evaluation.count >= 4 && discardIndexes.length > 0 ? 1 : 0;
  }
  const lowType = ["D02", "S02"].includes(variantId) ? "A5" : "27";
  const evaluation = evaluateLowHand({ cards: hand, lowType });
  const highest = evaluation?.metadata?.ranks?.[0] ?? 99;
  const shouldPat = lowType === "A5" ? highest <= 6 : highest <= 8;
  return shouldPat && actionType === "DRAW" && discardIndexes.length > 0 ? 1 : 0;
}

function evaluateRecklessRaise({ variantId, phase, actionType, drawRoundIndex = 0, hand = [] }) {
  if (phase !== "BET" || actionType !== "RAISE") return 0;
  if (variantId === "D03") {
    const evaluation = evaluateBadugi(hand);
    return drawRoundIndex >= 3 && evaluation.count < 4 ? 1 : 0;
  }
  const lowType = ["D02", "S02"].includes(variantId) ? "A5" : "27";
  const evaluation = evaluateLowHand({ cards: hand, lowType });
  const highest = evaluation?.metadata?.ranks?.[0] ?? 99;
  const weakThreshold = lowType === "A5" ? 8 : 10;
  return drawRoundIndex >= (variantId.startsWith("S") ? 1 : 3) && highest >= weakThreshold ? 1 : 0;
}

function buildTierAccumulator() {
  return {
    hands: 0,
    seatAppearances: 0,
    seatWins: 0,
    stackDeltaTotal: 0,
    stackDeltaValues: [],
    actions: 0,
    illegalActions: 0,
    freezes: 0,
    fallbackActions: 0,
    proOverlayActions: 0,
    onnxActions: 0,
    standardRuleActions: 0,
    safeFallbackActions: 0,
    drawMistakes: 0,
    recklessRaises: 0,
    callActions: 0,
    losingCalls: 0,
    frequencyDecisions: 0,
    valueBetActions: 0,
    checkBackActions: 0,
    foldFacingBetActions: 0,
    callFacingBetActions: 0,
    raiseActions: 0,
    frequencySourceBreakdown: {
      BET: 0,
      RAISE: 0,
      CALL: 0,
      CHECK: 0,
      FOLD: 0,
    },
    actionTypeCounts: {
      CALL: 0,
      BET: 0,
      RAISE: 0,
      FOLD: 0,
      CHECK: 0,
      DRAW: 0,
    },
    fallbackReasonCounts: {
      "no-rule-match": 0,
      "unsafe-action": 0,
      "missing-logic": 0,
      "illegal-block": 0,
    },
    divergenceCount: 0,
  };
}

function buildSeatAccumulator(tier = "standard") {
  return {
    tier,
    hands: 0,
    wins: 0,
    stackDeltaTotal: 0,
  };
}

function summarizeTierAccumulator(accumulator, bigBlind = 20, handsRequested = 1, handsCompleted = 0, evFailures = 0) {
  const seatAppearances = Math.max(1, accumulator.seatAppearances);
  const completedHands = Math.max(1, handsCompleted);
  const actionCount = Math.max(1, accumulator.actions);
  const fallbackActions = accumulator.fallbackActions;
  const varianceMean = accumulator.stackDeltaValues.length
    ? accumulator.stackDeltaValues.reduce((sum, value) => sum + value, 0) / accumulator.stackDeltaValues.length
    : 0;
  const variance = accumulator.stackDeltaValues.length
    ? accumulator.stackDeltaValues.reduce((sum, value) => sum + (value - varianceMean) ** 2, 0) / accumulator.stackDeltaValues.length
    : 0;
  return {
    handsPlayed: handsCompleted,
    handCompletionRate: handsCompleted / Math.max(1, handsRequested),
    winRate: accumulator.seatWins / seatAppearances,
    evPerHand: accumulator.stackDeltaTotal / completedHands,
    bbPer100: (accumulator.stackDeltaTotal / completedHands / Math.max(1, bigBlind)) * 100,
    illegalActionRate: accumulator.illegalActions / actionCount,
    fallbackRate: fallbackActions / actionCount,
    proOverlayRate: accumulator.proOverlayActions / actionCount,
    freezeRate: accumulator.freezes / Math.max(1, handsRequested),
    evIntegrityFailureRate: evFailures / Math.max(1, handsRequested),
    variance,
    drawMistakeRate: accumulator.drawMistakes / actionCount,
    recklessRaiseRate: accumulator.recklessRaises / actionCount,
    callRate: accumulator.callActions / actionCount,
    losingCallRate: accumulator.losingCalls / Math.max(1, accumulator.callActions),
    frequencyDecisionRate: accumulator.frequencyDecisions / actionCount,
    valueBetFrequency: accumulator.valueBetActions / actionCount,
    checkBackFrequency: accumulator.checkBackActions / actionCount,
    foldFacingBetFrequency: accumulator.foldFacingBetActions / actionCount,
    callFacingBetFrequency: accumulator.callFacingBetActions / actionCount,
    raiseFrequency: accumulator.raiseActions / actionCount,
    divergenceRate: accumulator.divergenceCount / actionCount,
    frequencySourceBreakdown: accumulator.frequencySourceBreakdown,
    actionCounts: {
      total: accumulator.actions,
      proOverlay: accumulator.proOverlayActions,
      onnx: accumulator.onnxActions,
      standardRule: accumulator.standardRuleActions,
      safeFallback: accumulator.safeFallbackActions,
      byType: accumulator.actionTypeCounts,
    },
    fallbackReasonCounts: accumulator.fallbackReasonCounts,
  };
}

function summarizeHandFailure({ handIndex, reason, trace = [], freeze = false, illegal = false, evFailure = false }) {
  return {
    handIndex,
    reason,
    freeze,
    illegal,
    evFailure,
    trace,
  };
}

async function playEvaluationHand({
  variantId,
  handIndex,
  seed,
  playerCount,
  seatAssignments,
  maxStepsPerHand,
  options = {},
}) {
  return withSeededRandom(seed, async () => {
    const divergenceOptions = normalizeDivergenceOptions(options);
    const controller = createControllerForVariant(variantId, playerCount);
    if (!controller) {
      return {
        status: "NOT_RUN",
        handIndex,
        reason: NOT_RUN_REASONS[variantId] ?? "UNSUPPORTED_VARIANT",
      };
    }
    let state = createInitialHandState(controller, variantId, playerCount);
    const beforeSnapshot = clone(state?.snapshot ?? controller.getUiSnapshot(state));
    const trace = [];
    const metrics = {
      actionsByTier: { standard: buildTierAccumulator(), pro: buildTierAccumulator() },
      seatDeltas: {},
      winners: [],
      evFailure: false,
      illegal: false,
      freeze: false,
      analysisEvents: [],
      callEvents: [],
      divergenceRecords: [],
      replaySamples: [],
    };

    for (let step = 0; step < maxStepsPerHand; step += 1) {
      const snapshot = state?.snapshot ?? controller.getUiSnapshot(state);
      if (snapshot && typeof snapshot === "object") {
        snapshot.metadata = {
          ...(snapshot.metadata ?? {}),
          evaluationSeed: seed,
          evaluationHandIndex: handIndex,
        };
      }
      const phase = String(snapshot?.phase ?? snapshot?.street ?? "").toUpperCase();
      const actor = getActorIndex(snapshot);
      if (isEvaluationTerminal(controller, state, snapshot)) {
        return finalizeHandResult({
          beforeSnapshot,
          snapshot: clone(snapshot),
          metrics,
          variantId,
          handIndex,
          trace,
        });
      }

      if (!Number.isInteger(actor)) {
        if (countLivePlayers(snapshot) <= 1 || !["BET", "DRAW"].includes(phase)) {
          return finalizeHandResult({
            beforeSnapshot,
            snapshot: clone(snapshot),
            metrics,
            variantId,
            handIndex,
            trace,
          });
        }
        metrics.freeze = true;
        return {
          status: "FAIL",
          handIndex,
          trace,
          metrics,
          reason: "missing-actor",
        };
      }

      const tierId = getSeatTier(seatAssignments, actor);
      const legalActions = controller.getLegalActions(state, actor);
      const hand = getHand(snapshot, actor);
      const decision = decideAction({
        controller,
        variantId,
        state,
        seatIndex: actor,
        tierId,
      });
      const proDecision =
        tierId === "pro"
          ? decision
          : decideAction({
              controller,
              variantId,
              state,
              seatIndex: actor,
              tierId: "pro",
            });
      const standardDecision =
        tierId === "standard"
          ? decision
          : decideAction({
              controller,
              variantId,
              state,
              seatIndex: actor,
              tierId: "standard",
            });
      const actionType = normalizeActionType(decision);
      const source = classifyActionSource(
        decision?.metadata?.decisionSource ?? decision?.source,
        tierId,
      );
      const actionPayload = buildActionPayload({
        seatIndex: actor,
        decision,
        tierId,
        currentBetAmount: getCurrentBet(snapshot, actor),
      });
      const tierMetrics = metrics.actionsByTier[tierId];
      const facingBetNow = getCurrentBet(snapshot, actor) > 0;
      const drawMistake = evaluateDrawMistake({
        variantId,
        phase,
        actionType,
        discardIndexes: actionPayload.discardIndexes,
        hand,
      });
      const recklessRaise = evaluateRecklessRaise({
        variantId,
        phase,
        actionType,
        drawRoundIndex: toNumber(snapshot?.drawRoundIndex ?? snapshot?.drawRound, 0),
        hand,
      });
      tierMetrics.actions += 1;
      if (tierMetrics.actionTypeCounts[actionType] != null) {
        tierMetrics.actionTypeCounts[actionType] += 1;
      }
      if (actionType === "CALL") {
        tierMetrics.callActions += 1;
      }
      if (actionType === "RAISE") {
        tierMetrics.raiseActions += 1;
      }
      if (actionPayload.metadata.frequencyControlled) {
        tierMetrics.frequencyDecisions += 1;
        if (tierMetrics.frequencySourceBreakdown[actionType] != null) {
          tierMetrics.frequencySourceBreakdown[actionType] += 1;
        }
      }
      if (!facingBetNow && ["BET", "RAISE"].includes(actionType)) {
        tierMetrics.valueBetActions += 1;
      }
      if (!facingBetNow && actionType === "CHECK") {
        tierMetrics.checkBackActions += 1;
      }
      if (facingBetNow && actionType === "FOLD") {
        tierMetrics.foldFacingBetActions += 1;
      }
      if (facingBetNow && actionType === "CALL") {
        tierMetrics.callFacingBetActions += 1;
      }
      if (!hasLegalAction(legalActions, actionType)) {
        tierMetrics.illegalActions += 1;
        metrics.illegal = true;
        trace.push({
          step,
          phase,
          actor,
          tierId,
          legalActions: legalActions.map((action) => String(action?.type ?? action)),
          attemptedAction: actionType,
          source,
          reason: "illegal-action-selected",
        });
        return {
          status: "FAIL",
          handIndex,
          trace,
          metrics,
          reason: "illegal-action-selected",
        };
      }

      if (source === "pro-overlay") tierMetrics.proOverlayActions += 1;
      if (source === "onnx") tierMetrics.onnxActions += 1;
      if (source === "standard-rule") tierMetrics.standardRuleActions += 1;
      if (source === "safe-fallback") tierMetrics.safeFallbackActions += 1;
      if (source === "standard-rule" || source === "safe-fallback") tierMetrics.fallbackActions += 1;
      const fallbackReasonCategory = toKebabCase(actionPayload.metadata.fallbackReasonCategory);
      if (
        tierId === "pro" &&
        (source === "standard-rule" || source === "safe-fallback") &&
        tierMetrics.fallbackReasonCounts[fallbackReasonCategory] != null
      ) {
        tierMetrics.fallbackReasonCounts[fallbackReasonCategory] += 1;
      }
      tierMetrics.drawMistakes += drawMistake;
      tierMetrics.recklessRaises += recklessRaise;
      const divergenceRecord = buildDivergenceRecord({
        variantId,
        seed,
        handIndex,
        step,
        snapshot,
        seatIndex: actor,
        legalActions,
        hand,
        proDecision,
        standardDecision,
        actualTier: tierId,
        actualActionType: actionType,
      });
      if (divergenceRecord) {
        metrics.divergenceRecords.push(divergenceRecord);
        tierMetrics.divergenceCount += 1;
        if (
          divergenceOptions.captureDivergence &&
          metrics.replaySamples.length < Math.max(120, divergenceOptions.maxReplaySamples)
        ) {
          metrics.replaySamples.push(
            buildReplaySample({
              variantId,
              seed,
              handIndex,
              step,
              state,
              snapshot,
              seatIndex: actor,
              legalActions,
              hand,
              proDecision,
              standardDecision,
            }),
          );
        }
      }

      if (
        tierId === "pro" &&
        metrics.analysisEvents.length < 160 &&
        (options?.detailedTrace || source !== "pro-overlay" || drawMistake > 0 || recklessRaise > 0)
      ) {
        const livePlayers = countLivePlayers(snapshot);
        const raiseCountThisRound = toNumber(
          snapshot?.metadata?.raiseCountThisRound ?? snapshot?.raiseCountThisRound,
          0,
        );
        metrics.analysisEvents.push({
          handIndex,
          step,
          phase,
          seatIndex: actor,
          tierId,
          drawRoundIndex: toNumber(snapshot?.drawRoundIndex ?? snapshot?.drawRound, 0),
          source,
          actionType,
          reason: actionPayload.metadata.decisionReason,
          fallbackReasonCategory:
            source === "standard-rule" || source === "safe-fallback"
              ? fallbackReasonCategory || "missing-logic"
              : null,
          warnings: actionPayload.metadata.warnings ?? [],
          legalActions: legalActions.map((action) => String(action?.type ?? action)),
          toCall: getCurrentBet(snapshot, actor),
          potSize: getPotSize(snapshot),
          betSizeBucket: classifyBetSizeBucket(getCurrentBet(snapshot, actor), getPotSize(snapshot)),
          livePlayers,
          headsUp: livePlayers <= 2,
          multiwayClass: livePlayers >= 4 ? "4way+" : livePlayers === 3 ? "3way" : "heads-up",
          facingBet: getCurrentBet(snapshot, actor) > 0,
          facingRaise: getCurrentBet(snapshot, actor) > 0 && raiseCountThisRound > 0,
          raiseCountThisRound,
          drawMistake,
          recklessRaise,
          handSummary: summarizeHandFeatures({ variantId, hand }),
        });
      }

      if (tierId === "pro" && variantId === "D02" && phase === "BET" && actionType === "CALL" && metrics.callEvents.length < 240) {
        const toCall = getCurrentBet(snapshot, actor);
        const potSize = getPotSize(snapshot);
        metrics.callEvents.push({
          handIndex,
          step,
          seatIndex: actor,
          drawRoundIndex: toNumber(snapshot?.drawRoundIndex ?? snapshot?.drawRound, 0),
          toCall,
          potSize,
          betSizeBucket: classifyBetSizeBucket(toCall, potSize),
          handClass: classifyD02HandClass(hand),
          actionType,
          source,
          handSummary: summarizeHandFeatures({ variantId, hand }),
        });
      }

      trace.push({
        step,
        phase,
        actor,
        tierId,
        legalActions: legalActions.map((action) => String(action?.type ?? action)),
        actionType,
        source,
        reason: actionPayload.metadata.decisionReason,
      });

      const result = controller.applyAction(state, actionPayload);
      const invalidEvent = result?.events?.find((event) =>
        ["invalidAction", "error"].includes(String(event?.type ?? "")),
      );
      if (invalidEvent) {
        tierMetrics.illegalActions += 1;
        metrics.illegal = true;
        trace.push({
          step,
          phase,
          actor,
          tierId,
          actionType,
          source,
          reason: invalidEvent?.error ?? invalidEvent?.message ?? "action-rejected",
        });
        return {
          status: "FAIL",
          handIndex,
          trace,
          metrics,
          reason: invalidEvent?.error ?? invalidEvent?.message ?? "action-rejected",
        };
      }
      state = result.state;
    }

    metrics.freeze = true;
    return {
      status: "FAIL",
      handIndex,
      trace,
      metrics,
      reason: "max-steps-exceeded",
    };
  });
}

export async function runAiEvaluationBatch({
  variantId,
  seed = 20260506,
  hands = DEFAULT_HANDS,
  playerCount = DEFAULT_PLAYER_COUNT,
  tiers = ["standard", "pro"],
  seatAssignments = null,
  maxStepsPerHand = DEFAULT_MAX_STEPS,
  options = {},
} = {}) {
  const normalizedVariantId = String(variantId ?? "").toUpperCase();
  const divergenceOptions = normalizeDivergenceOptions(options);
  if (!SUPPORTED_VARIANTS.has(normalizedVariantId)) {
    return {
      variantId: normalizedVariantId,
      seed,
      handsRequested: hands,
      handsCompleted: 0,
      status: "NOT_RUN",
      reason: NOT_RUN_REASONS[normalizedVariantId] ?? "NOT_SUPPORTED_IN_STEP3",
      resultsByTier: {},
      resultsBySeat: {},
      failures: [],
      traces: [],
      summary: {},
      seatAssignments: normalizeSeatAssignments(seatAssignments, playerCount),
      tiers,
      analysis: {
        divergenceRecords: [],
        divergenceReplaySamples: [],
      },
    };
  }

  const assignments = normalizeSeatAssignments(seatAssignments, playerCount);
  const tierAccumulators = {
    standard: buildTierAccumulator(),
    pro: buildTierAccumulator(),
  };
  const seatAccumulators = Object.fromEntries(
    Array.from({ length: playerCount }, (_, seatIndex) => [
      seatIndex,
      buildSeatAccumulator(getSeatTier(assignments.primary, seatIndex)),
    ]),
  );
  const failures = [];
  const traces = [];
  const analysis = {
    fallbackSamples: [],
    lossSamples: [],
    patMistakeSamples: [],
    divergenceReplaySamples: [],
  };
  let handsCompleted = 0;
  let evFailures = 0;

  for (let handIndex = 0; handIndex < hands; handIndex += 1) {
    const assignment = handIndex % 2 === 0 ? assignments.primary : assignments.mirrored;
    const handSeed = seed + handIndex * 97;
    const result = await playEvaluationHand({
      variantId: normalizedVariantId,
      handIndex,
      seed: handSeed,
      playerCount,
      seatAssignments: assignment,
      maxStepsPerHand,
      options,
    });
    const traceEntry = {
      handIndex,
      seed: handSeed,
      seatAssignments: assignment,
      status: result.status,
      reason: result.reason ?? null,
    };
    if (options?.detailedTrace) {
      traceEntry.metrics = {
        winners: result.metrics?.winners ?? [],
        seatDeltas: result.metrics?.seatDeltas ?? {},
        evFailure: Boolean(result.metrics?.evFailure),
        illegal: Boolean(result.metrics?.illegal),
        freeze: Boolean(result.metrics?.freeze),
        analysisEvents: result.metrics?.analysisEvents ?? [],
        callEvents: result.metrics?.callEvents ?? [],
        divergenceRecords: result.metrics?.divergenceRecords ?? [],
        replaySamples: result.metrics?.replaySamples ?? [],
      };
      traceEntry.snapshotSummary = result.snapshot
        ? {
            phase: result.snapshot?.phase ?? result.snapshot?.street ?? null,
            pot: getFinalPot(result.snapshot),
            livePlayers: countLivePlayers(result.snapshot),
          }
        : null;
    }
    traces.push(traceEntry);
    const handReachedTerminal = Boolean(result.snapshot);

    ["standard", "pro"].forEach((tierId) => {
      const handMetrics = result.metrics?.actionsByTier?.[tierId];
      if (!handMetrics) return;
      tierAccumulators[tierId].actions += handMetrics.actions;
      tierAccumulators[tierId].illegalActions += handMetrics.illegalActions;
      tierAccumulators[tierId].fallbackActions += handMetrics.fallbackActions;
      tierAccumulators[tierId].proOverlayActions += handMetrics.proOverlayActions;
      tierAccumulators[tierId].onnxActions += handMetrics.onnxActions;
      tierAccumulators[tierId].standardRuleActions += handMetrics.standardRuleActions;
      tierAccumulators[tierId].safeFallbackActions += handMetrics.safeFallbackActions;
      tierAccumulators[tierId].drawMistakes += handMetrics.drawMistakes;
      tierAccumulators[tierId].recklessRaises += handMetrics.recklessRaises;
      tierAccumulators[tierId].callActions += handMetrics.callActions ?? 0;
      tierAccumulators[tierId].frequencyDecisions += handMetrics.frequencyDecisions ?? 0;
      tierAccumulators[tierId].valueBetActions += handMetrics.valueBetActions ?? 0;
      tierAccumulators[tierId].checkBackActions += handMetrics.checkBackActions ?? 0;
      tierAccumulators[tierId].foldFacingBetActions += handMetrics.foldFacingBetActions ?? 0;
      tierAccumulators[tierId].callFacingBetActions += handMetrics.callFacingBetActions ?? 0;
      tierAccumulators[tierId].raiseActions += handMetrics.raiseActions ?? 0;
      Object.entries(handMetrics.actionTypeCounts ?? {}).forEach(([actionType, count]) => {
        if (tierAccumulators[tierId].actionTypeCounts[actionType] == null) {
          tierAccumulators[tierId].actionTypeCounts[actionType] = 0;
        }
        tierAccumulators[tierId].actionTypeCounts[actionType] += count;
      });
      Object.entries(handMetrics.fallbackReasonCounts ?? {}).forEach(([category, count]) => {
        if (tierAccumulators[tierId].fallbackReasonCounts[category] == null) {
          tierAccumulators[tierId].fallbackReasonCounts[category] = 0;
        }
        tierAccumulators[tierId].fallbackReasonCounts[category] += count;
      });
      Object.entries(handMetrics.frequencySourceBreakdown ?? {}).forEach(([actionType, count]) => {
        if (tierAccumulators[tierId].frequencySourceBreakdown[actionType] == null) {
          tierAccumulators[tierId].frequencySourceBreakdown[actionType] = 0;
        }
        tierAccumulators[tierId].frequencySourceBreakdown[actionType] += count;
      });
    });

    (result.metrics?.analysisEvents ?? []).forEach((event) => {
      if (
        (event.source === "standard-rule" || event.source === "safe-fallback") &&
        analysis.fallbackSamples.length < 48
      ) {
        analysis.fallbackSamples.push({
          variantId: normalizedVariantId,
          handIndex,
          ...event,
        });
      }
      if (event.drawMistake > 0 && analysis.patMistakeSamples.length < 32) {
        analysis.patMistakeSamples.push({
          variantId: normalizedVariantId,
          handIndex,
          ...event,
        });
      }
    });

    (result.metrics?.callEvents ?? []).forEach((event) => {
      if (!analysis.d02CallEvents) {
        analysis.d02CallEvents = [];
      }
      if (analysis.d02CallEvents.length < 240) {
        analysis.d02CallEvents.push({
          variantId: normalizedVariantId,
          ...event,
        });
      }
    });

    (result.metrics?.divergenceRecords ?? []).forEach((event) => {
      if (!divergenceOptions.captureDivergence) return;
      if (!analysis.divergenceRecords) {
        analysis.divergenceRecords = [];
      }
      if (analysis.divergenceRecords.length < divergenceOptions.maxDivergenceRecords) {
        analysis.divergenceRecords.push({
          variantId: normalizedVariantId,
          ...event,
        });
      }
    });

    (result.metrics?.replaySamples ?? []).forEach((sample) => {
      if (canStoreReplaySample(sample, analysis, divergenceOptions)) {
        analysis.divergenceReplaySamples.push({
          variantId: normalizedVariantId,
          ...sample,
        });
      }
    });

    if (result.metrics?.freeze) {
      tierAccumulators.standard.freezes += 1;
      tierAccumulators.pro.freezes += 1;
    }

    if (handReachedTerminal) {
      handsCompleted += 1;
      const winners = new Set(result.metrics?.winners ?? []);
      for (let seatIndex = 0; seatIndex < playerCount; seatIndex += 1) {
        const tierId = getSeatTier(assignment, seatIndex);
        const seatAccumulator = seatAccumulators[seatIndex];
        const tierAccumulator = tierAccumulators[tierId];
        const delta = toNumber(result.metrics?.seatDeltas?.[seatIndex], 0);
        seatAccumulator.tier = tierId;
        seatAccumulator.hands += 1;
        seatAccumulator.stackDeltaTotal += delta;
        seatAccumulator.wins += winners.has(seatIndex) ? 1 : 0;

        tierAccumulator.hands += 1;
        tierAccumulator.seatAppearances += 1;
        tierAccumulator.stackDeltaTotal += delta;
        tierAccumulator.stackDeltaValues.push(delta);
        tierAccumulator.seatWins += winners.has(seatIndex) ? 1 : 0;

        if (
          tierId === "pro" &&
          delta < 0 &&
          analysis.lossSamples.length < 48
        ) {
          analysis.lossSamples.push({
            variantId: normalizedVariantId,
            handIndex,
            seatIndex,
            delta,
            winner: winners.has(seatIndex),
            handSummary: summarizeHandFeatures({
              variantId: normalizedVariantId,
              hand: result.snapshot?.players?.[seatIndex]?.hand ?? [],
            }),
          });
        }
      }
      (result.metrics?.callEvents ?? []).forEach((event) => {
        if (event.seatDelta < 0) {
          tierAccumulators.pro.losingCalls += 1;
        }
      });
    }

    if (result.metrics?.evFailure) {
      evFailures += 1;
    }

    if (result.status !== "PASS") {
      failures.push(
        summarizeHandFailure({
          handIndex,
          reason: result.reason ?? (result.metrics?.evFailure ? "ev-integrity-failure" : "hand-failed"),
          trace: result.trace?.slice(-8) ?? [],
          freeze: Boolean(result.metrics?.freeze),
          illegal: Boolean(result.metrics?.illegal),
          evFailure: Boolean(result.metrics?.evFailure),
        }),
      );
    }
  }

  const bigBlind = BIG_BLIND_BY_VARIANT[normalizedVariantId] ?? 20;
  const resultsByTier = {
    standard: summarizeTierAccumulator(
      tierAccumulators.standard,
      bigBlind,
      hands,
      handsCompleted,
      evFailures,
    ),
    pro: summarizeTierAccumulator(
      tierAccumulators.pro,
      bigBlind,
      hands,
      handsCompleted,
      evFailures,
    ),
  };
  const resultsBySeat = Object.fromEntries(
    Object.entries(seatAccumulators).map(([seatIndex, accumulator]) => [
      seatIndex,
      {
        tier: accumulator.tier,
        handsPlayed: accumulator.hands,
        winRate: accumulator.wins / Math.max(1, accumulator.hands),
        evPerHand: accumulator.stackDeltaTotal / Math.max(1, accumulator.hands),
      },
    ]),
  );

  const proEv = resultsByTier.pro.evPerHand;
  const standardEv = resultsByTier.standard.evPerHand;
  const verdict =
    handsCompleted < Math.min(10, hands)
      ? "NOT_ENOUGH_DATA"
      : proEv > standardEv + 0.01
        ? "PRO_BETTER"
        : proEv < standardEv - 0.01
          ? "PRO_WORSE"
          : "PRO_NEUTRAL";

  return {
    variantId: normalizedVariantId,
    seed,
    handsRequested: hands,
    handsCompleted,
    status: failures.length && handsCompleted === 0 ? "INVALID_RUN" : "PASS",
    resultsByTier,
    resultsBySeat,
    failures,
    traces,
    seatAssignments: assignments,
    summary: {
      handCompletionRate: handsCompleted / Math.max(1, hands),
      illegalActionRate: Math.max(
        resultsByTier.standard.illegalActionRate,
        resultsByTier.pro.illegalActionRate,
      ),
      freezeRate: Math.max(resultsByTier.standard.freezeRate, resultsByTier.pro.freezeRate),
      evIntegrityFailureRate: Math.max(
        resultsByTier.standard.evIntegrityFailureRate,
        resultsByTier.pro.evIntegrityFailureRate,
      ),
      verdict,
      options,
    },
    analysis: {
      ...analysis,
      fallbackReasonCounts: resultsByTier.pro.fallbackReasonCounts ?? {},
    },
    tiers,
  };
}

export async function runProVsStandardEvaluationSuite({
  variants = MAJOR_10_VARIANTS,
  seed = 20260506,
  hands = DEFAULT_HANDS,
  playerCount = DEFAULT_PLAYER_COUNT,
  maxStepsPerHand = DEFAULT_MAX_STEPS,
  options = {},
} = {}) {
  const runId = `pro-vs-standard-${seed}`;
  const normalizedVariants = variants.map((variantId) => String(variantId).toUpperCase());
  const results = {};
  for (const variantId of normalizedVariants) {
    results[variantId] = await runAiEvaluationBatch({
      variantId,
      seed,
      hands,
      playerCount,
      maxStepsPerHand,
      options,
    });
  }
  return {
    runId,
    createdAt: new Date().toISOString(),
    seed,
    hands,
    playerCount,
    variants: results,
    actionDivergence: analyzeActionDivergence({ variants: results }),
  };
}

export async function writeEvaluationJson(report, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return outputPath;
}

export async function writeDivergenceReplaySamples(report, { seed = null } = {}) {
  await fs.mkdir(AI_EVAL_DIVERGENCE_REPLAY_DIR, { recursive: true });
  const written = [];
  for (const [variantId, result] of Object.entries(report?.variants ?? {})) {
    const samples = result?.analysis?.divergenceReplaySamples ?? [];
    if (!samples.length) continue;
    const safeSeed = seed ?? report?.seed ?? "unknown";
    const divergenceOptions = normalizeDivergenceOptions(result?.summary?.options ?? {});
    const prefix = divergenceOptions.divergenceSampleTag
      ? `${divergenceOptions.divergenceSampleTag.toLowerCase()}-`
      : "";
    const filePath = path.join(
      AI_EVAL_DIVERGENCE_REPLAY_DIR,
      `${prefix}${String(variantId).toLowerCase()}-${safeSeed}.jsonl`,
    );
    const content = `${samples.map((sample) => JSON.stringify(sample)).join("\n")}\n`;
    await fs.writeFile(filePath, content, "utf8");
    written.push(filePath);
  }
  return written;
}

export function getDefaultEvalOutputPath(seed = 20260506) {
  return path.join(AI_EVAL_REPORT_DIR, `pro-vs-standard-${seed}.json`);
}

export { MAJOR_10_VARIANTS };
export {
  buildActionPayload,
  createControllerForVariant,
  decideAction,
  isEvaluationTerminal,
  getCurrentBet,
  normalizeActionType,
  clone,
};
