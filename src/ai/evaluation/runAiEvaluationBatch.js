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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AI_EVAL_REPORT_DIR = path.resolve(__dirname, "../../../reports/ai-eval");

const DEFAULT_HANDS = 40;
const DEFAULT_PLAYER_COUNT = 6;
const DEFAULT_MAX_STEPS = 300;
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
    fallbackReasonCounts: {
      "no-rule-match": 0,
      "unsafe-action": 0,
      "missing-logic": 0,
      "illegal-block": 0,
    },
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
    actionCounts: {
      total: accumulator.actions,
      proOverlay: accumulator.proOverlayActions,
      onnx: accumulator.onnxActions,
      standardRule: accumulator.standardRuleActions,
      safeFallback: accumulator.safeFallbackActions,
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
}) {
  return withSeededRandom(seed, async () => {
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
    };

    for (let step = 0; step < maxStepsPerHand; step += 1) {
      const snapshot = state?.snapshot ?? controller.getUiSnapshot(state);
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

      if (
        tierId === "pro" &&
        metrics.analysisEvents.length < 160 &&
        (source !== "pro-overlay" || drawMistake > 0 || recklessRaise > 0)
      ) {
        metrics.analysisEvents.push({
          handIndex,
          step,
          phase,
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
          drawMistake,
          recklessRaise,
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
    });
    traces.push({
      handIndex,
      seed: handSeed,
      seatAssignments: assignment,
      status: result.status,
      reason: result.reason ?? null,
    });
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
      Object.entries(handMetrics.fallbackReasonCounts ?? {}).forEach(([category, count]) => {
        if (tierAccumulators[tierId].fallbackReasonCounts[category] == null) {
          tierAccumulators[tierId].fallbackReasonCounts[category] = 0;
        }
        tierAccumulators[tierId].fallbackReasonCounts[category] += count;
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
    });
  }
  return {
    runId,
    createdAt: new Date().toISOString(),
    seed,
    hands,
    playerCount,
    variants: results,
  };
}

export async function writeEvaluationJson(report, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  return outputPath;
}

export function getDefaultEvalOutputPath(seed = 20260506) {
  return path.join(AI_EVAL_REPORT_DIR, `pro-vs-standard-${seed}.json`);
}

export { MAJOR_10_VARIANTS };
