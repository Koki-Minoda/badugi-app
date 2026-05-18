import fs from "node:fs";
import path from "node:path";
import { summarizeCpuDecisionTrace } from "./summarizeCpuDecisionTrace.js";

const DRAW_VARIANTS = new Set(["badugi", "D01", "D02", "S01", "S02"]);

export function normalizeCpuActionType(action) {
  const raw =
    typeof action === "string"
      ? action
      : action?.type ?? action?.selectedAction ?? action?.finalAction ?? "unknown";
  const lower = String(raw).toLowerCase();
  if (lower === "bet") return "raise";
  return lower;
}

export function classifyDecisionSource(metadata = {}, requestedTier = null) {
  const rawSource = metadata?.decisionSource ?? metadata?.source ?? metadata?.strategy ?? null;
  const source = rawSource ? String(rawSource) : "heuristic";
  if (source.includes("fallback")) return "fallback";
  if (source.includes("pro") || source.includes("overlay") || requestedTier === "pro") {
    return source.includes("ruleBased") ? "heuristic" : "pro-overlay";
  }
  if (source.includes("ruleBased") || source.includes("heuristic")) return "heuristic";
  if (source === "policy-router") return "heuristic";
  return source;
}

export function classifyHandStrengthBucket({ variantId, metadata = {}, action = null } = {}) {
  if (metadata?.handStrengthBucket) return metadata.handStrengthBucket;
  const drawCount = Number(metadata?.drawCount);
  const highestRank = Number(metadata?.highestRank);
  if (DRAW_VARIANTS.has(variantId) || DRAW_VARIANTS.has(String(variantId))) {
    if (Number.isFinite(drawCount)) {
      if (drawCount <= 0) return "strong";
      if (drawCount === 1) return "medium";
      if (drawCount === 2) return "weak";
      return "trash";
    }
    if (Number.isFinite(highestRank)) {
      if (highestRank <= 8) return "strong";
      if (highestRank <= 10) return "medium";
      if (highestRank <= 12) return "weak";
      return "trash";
    }
  }
  const normalized = normalizeCpuActionType(action);
  if (normalized === "raise") return "strong";
  if (normalized === "call" || normalized === "check") return "medium";
  if (normalized === "fold") return "weak";
  return "unknown";
}

export function buildCpuDecisionTraceRow({
  handId = null,
  variantId = null,
  mode = "cash",
  seat = null,
  position = null,
  phase = null,
  drawRound = null,
  betRound = null,
  legalActions = [],
  selectedAction = null,
  finalAction = null,
  decisionSource = null,
  fallbackReason = null,
  metadata = {},
  toCall = 0,
  currentBet = 0,
  pot = 0,
  stack = 0,
  positionContext = null,
  rlRequestSent = false,
  rlResponseValid = false,
  applySuccess = true,
  illegalActionRejected = false,
  forcedFold = false,
} = {}) {
  const normalizedFinal = normalizeCpuActionType(finalAction ?? selectedAction);
  const normalizedLegal = Array.isArray(legalActions)
    ? legalActions.map((entry) => normalizeCpuActionType(entry))
    : [];
  const source = decisionSource ?? classifyDecisionSource(metadata);
  return {
    timestamp: Date.now(),
    handId,
    variantId,
    mode,
    seat,
    position,
    phase,
    drawRound,
    betRound,
    legalActions: normalizedLegal,
    selectedAction: normalizeCpuActionType(selectedAction),
    decisionSource: source,
    fallbackReason,
    handStrengthBucket: classifyHandStrengthBucket({
      variantId,
      metadata,
      action: normalizedFinal,
    }),
    toCall: Number(toCall) || 0,
    currentBet: Number(currentBet) || 0,
    pot: Number(pot) || 0,
    stack: Number(stack) || 0,
    positionContext,
    rlRequestSent: Boolean(rlRequestSent),
    rlResponseValid: Boolean(rlResponseValid),
    rlAction: metadata?.rlAction ?? null,
    finalAction: normalizedFinal,
    drawCount: Number.isFinite(Number(metadata?.drawCount)) ? Number(metadata.drawCount) : null,
    pat: metadata?.pat === true,
    applySuccess: Boolean(applySuccess),
    illegalActionRejected: Boolean(illegalActionRejected),
    forcedFold: Boolean(forcedFold),
  };
}

export function recordBrowserCpuDecisionTrace(row) {
  if (typeof window === "undefined") return;
  window.__MGX_CPU_DECISION_TRACE__ ??= [];
  window.__MGX_CPU_DECISION_TRACE__.push(row);
}

export function createCpuDecisionTrace() {
  const rows = [];
  return {
    rows,
    record(row) {
      rows.push(row);
      return row;
    },
    summarize() {
      return summarizeCpuDecisionTrace(rows);
    },
    writeJsonl(filePath) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join("\n"));
    },
    writeSummary(filePath) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, `${JSON.stringify(this.summarize(), null, 2)}\n`);
    },
  };
}

export default createCpuDecisionTrace;
