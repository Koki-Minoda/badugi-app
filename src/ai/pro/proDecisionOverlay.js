import { getVariantById } from "../../games/config/variantCatalog.js";
import {
  chooseDeterministicSafeProAction,
  clampConfidence,
  legalActionTypes,
  normalizeDecision,
  sanitizeDiscardIndexes,
} from "./strategyUtils.js";
import { chooseBadugiProStrategy } from "./strategies/badugiProStrategy.js";
import { chooseDrawLowballProStrategy } from "./strategies/drawLowballProStrategy.js";
import { chooseHoldemProStrategy } from "./strategies/holdemProStrategy.js";
import { chooseOmahaProStrategy } from "./strategies/omahaProStrategy.js";
import { chooseStudProStrategy } from "./strategies/studProStrategy.js";
import { chooseSplitPotProStrategy } from "./strategies/splitPotProStrategy.js";

function inferFamily(variantId, family) {
  if (family) return family;
  const variant = getVariantById(variantId);
  if (!variant) return null;
  if (variant.id === "D03") return "badugi";
  if (["D01", "D02", "S01", "S02"].includes(variant.id)) return "draw-lowball";
  if (variant.category === "board" && variant.tags?.includes("holdem")) return "holdem";
  if (variant.category === "board" && variant.tags?.includes("omaha")) return "omaha";
  if (variant.category === "stud") return "stud";
  if (variant.evaluators?.some((tag) => String(tag).includes("split"))) return "split-pot";
  return variant.category ?? null;
}

function normalizeLegalActionStrings(legalActions = []) {
  return legalActionTypes(legalActions);
}

function isDrawAction(decision) {
  return decision?.type === "DRAW";
}

function isBettingAction(decision) {
  return ["BET", "RAISE", "CALL", "CHECK", "FOLD"].includes(decision?.type);
}

function isBlockedAllInAction(decision) {
  return ["BET", "RAISE", "CALL"].includes(decision?.type);
}

function validateDecisionAgainstLegal({
  decision = null,
  legalActions = [],
  snapshot = {},
  actor = null,
} = {}) {
  const normalized = normalizeDecision(decision);
  if (!normalized) {
    return { valid: false, reason: "missing-action" };
  }
  const legalTypes = normalizeLegalActionStrings(legalActions);
  if (!legalTypes.includes(normalized.type)) {
    return { valid: false, reason: "illegal-action-type" };
  }
  if (
    isBettingAction(normalized) &&
    (actor?.folded || actor?.busted || actor?.seatOut || actor?.sittingOut)
  ) {
    return { valid: false, reason: "inactive-actor" };
  }
  if (isBlockedAllInAction(normalized) && actor?.allIn) {
    return { valid: false, reason: "all-in-cannot-bet" };
  }
  if (isDrawAction(normalized)) {
    const hand = Array.isArray(actor?.hand) ? actor.hand : [];
    const maxDiscardCount =
      Number(snapshot?.maxDiscardCount ?? snapshot?.handCardCount ?? hand.length) || hand.length;
    normalized.discardIndexes = sanitizeDiscardIndexes(
      normalized.discardIndexes,
      maxDiscardCount,
      hand.length,
    );
    if (normalized.discardIndexes.length > maxDiscardCount) {
      return { valid: false, reason: "discard-cap-exceeded" };
    }
  }
  return { valid: true, decision: normalized };
}

function chooseStrategy({
  variantId,
  family,
  snapshot,
  legalActions,
  actor,
} = {}) {
  switch (family) {
    case "badugi":
      return chooseBadugiProStrategy({ variantId, snapshot, legalActions, actor });
    case "draw-lowball":
      return chooseDrawLowballProStrategy({ variantId, snapshot, legalActions, actor });
    case "holdem":
      return chooseHoldemProStrategy({ variantId, snapshot, legalActions, actor });
    case "omaha":
      return chooseOmahaProStrategy({ variantId, snapshot, legalActions, actor });
    case "stud":
      return chooseStudProStrategy({ variantId, snapshot, legalActions, actor });
    case "split-pot":
      return chooseSplitPotProStrategy({ variantId, snapshot, legalActions, actor });
    default:
      return null;
  }
}

function inferFallbackReasonCategory({
  strategyDecision,
  validatedStrategy,
  candidateAction,
  validatedCandidate,
  standardAction,
} = {}) {
  if (candidateAction && !validatedCandidate?.valid) {
    return "illegal-block";
  }
  if (strategyDecision && !validatedStrategy?.valid) {
    return "unsafe-action";
  }
  if (!strategyDecision && standardAction) {
    return "missing-logic";
  }
  return "no-rule-match";
}

function inferBlockedOverrideAction({
  chosenDecision = null,
  candidateAction = null,
  standardAction = null,
  legalActions = [],
  snapshot = {},
  actor = null,
} = {}) {
  const chosenType = normalizeDecision(chosenDecision)?.type ?? null;
  if (!chosenType) return null;

  const validatedCandidate = validateDecisionAgainstLegal({
    decision: candidateAction,
    legalActions,
    snapshot,
    actor,
  });
  if (validatedCandidate.valid && validatedCandidate.decision?.type !== chosenType) {
    return validatedCandidate.decision.type;
  }

  const validatedStandard = validateDecisionAgainstLegal({
    decision: standardAction,
    legalActions,
    snapshot,
    actor,
  });
  if (validatedStandard.valid && validatedStandard.decision?.type !== chosenType) {
    return validatedStandard.decision.type;
  }

  return null;
}

export function chooseProAction({
  variantId,
  family = null,
  snapshot = {},
  observation = null,
  legalActions = [],
  candidateAction = null,
  standardAction = null,
  context = {},
} = {}) {
  const actor =
    context.actor ??
    snapshot?.players?.[snapshot?.actingPlayerIndex] ??
    observation?.actor ??
    null;
  const resolvedFamily = inferFamily(variantId, family);
  const warnings = [];
  const strategyDecision = chooseStrategy({
    variantId,
    family: resolvedFamily,
    snapshot,
    legalActions,
    actor,
  });
  if (!strategyDecision && ["holdem", "omaha", "stud", "split-pot"].includes(resolvedFamily)) {
    warnings.push(`unsupported-family:${resolvedFamily}`);
  }
  const validatedStrategy = validateDecisionAgainstLegal({
    decision: strategyDecision,
    legalActions,
    snapshot,
    actor,
  });
  if (validatedStrategy.valid) {
    return {
      ...validatedStrategy.decision,
      source: "pro-overlay",
      reason: strategyDecision?.reason ?? "obvious-mistake-prevention",
      confidence: clampConfidence(strategyDecision?.confidence, 0.8),
      blockedAction: inferBlockedOverrideAction({
        chosenDecision: validatedStrategy.decision,
        candidateAction,
        standardAction,
        legalActions,
        snapshot,
        actor,
      }),
      warnings,
    };
  }
  if (strategyDecision && !validatedStrategy.valid) {
    warnings.push(`overlay-rejected:${validatedStrategy.reason}`);
  }

  const validatedCandidate = validateDecisionAgainstLegal({
    decision: candidateAction,
    legalActions,
    snapshot,
    actor,
  });
  if (validatedCandidate.valid) {
    return {
      ...validatedCandidate.decision,
      source: candidateAction?.source ?? "onnx",
      reason: candidateAction?.reason ?? "candidate-valid",
      confidence: clampConfidence(candidateAction?.confidence, 0.64),
      fallbackReasonCategory: null,
      blockedAction: null,
      warnings,
    };
  }
  if (candidateAction) {
    warnings.push(`candidate-blocked:${validatedCandidate.reason}`);
  }

  const validatedStandard = validateDecisionAgainstLegal({
    decision: standardAction,
    legalActions,
    snapshot,
    actor,
  });
  if (validatedStandard.valid) {
    const fallbackReasonCategory = inferFallbackReasonCategory({
      strategyDecision,
      validatedStrategy,
      candidateAction,
      validatedCandidate,
      standardAction,
    });
    return {
      ...validatedStandard.decision,
      source: "standard-rule",
      reason:
        standardAction?.reason ??
        (warnings.some((warning) => warning.startsWith("unsupported-family:"))
          ? `unsupported-pro-rules:${resolvedFamily}`
          : "standard-fallback"),
      confidence: clampConfidence(standardAction?.confidence, 0.55),
      fallbackReasonCategory,
      blockedAction: candidateAction ? normalizeDecision(candidateAction)?.type ?? null : null,
      warnings,
    };
  }
  if (standardAction) {
    warnings.push(`standard-blocked:${validatedStandard.reason}`);
  }

  const safe = chooseDeterministicSafeProAction({
    legalActions,
    hand: actor?.hand ?? [],
    allowDraw: String(snapshot?.street ?? snapshot?.phase ?? "").toUpperCase() === "DRAW",
  });
  const validatedSafe = validateDecisionAgainstLegal({
    decision: safe,
    legalActions,
    snapshot,
    actor,
  });
  if (validatedSafe.valid) {
    const unsupportedReason = warnings.some((warning) => warning.startsWith("unsupported-family:"))
      ? `unsupported-pro-rules:${resolvedFamily}`
      : null;
    const fallbackReasonCategory = inferFallbackReasonCategory({
      strategyDecision,
      validatedStrategy,
      candidateAction,
      validatedCandidate,
      standardAction,
    });
    return {
      ...validatedSafe.decision,
      source: "safe-fallback",
      reason: unsupportedReason ?? safe?.reason ?? "deterministic-safe-fallback",
      confidence: 1,
      fallbackReasonCategory,
      blockedAction: normalizeDecision(candidateAction)?.type ?? null,
      warnings,
    };
  }

  return {
    action: null,
    type: null,
    source: "safe-fallback",
    reason: "no-legal-pro-action",
    confidence: 0,
    fallbackReasonCategory: "no-rule-match",
    blockedAction: normalizeDecision(candidateAction)?.type ?? null,
    warnings,
  };
}
