const CANONICAL_ACTIONS = new Set(["fold", "check", "call", "bet", "raise", "draw", "pat"]);

function normalizeToken(value) {
  const token = String(value ?? "").trim().toLowerCase();
  if (!token) return null;
  if (token === "stand pat" || token === "stand-pat") return "pat";
  if (token.startsWith("draw")) return "draw";
  if (CANONICAL_ACTIONS.has(token)) return token;
  return token;
}

function normalizeLegalActions(legalActions = []) {
  if (!Array.isArray(legalActions)) return [];
  return legalActions
    .map((entry) => normalizeToken(typeof entry === "string" ? entry : entry?.action ?? entry?.type))
    .filter(Boolean);
}

function pickActionField(raw = {}) {
  if (raw && Object.prototype.hasOwnProperty.call(raw, "action")) {
    return { sourceActionField: "action", value: raw.action };
  }
  if (raw && Object.prototype.hasOwnProperty.call(raw, "type")) {
    return { sourceActionField: "type", value: raw.type };
  }
  return { sourceActionField: null, value: null };
}

function normalizeDiscardIndexes(raw = {}) {
  const indexes = raw.discardIndexes ?? raw.discards ?? raw.discard_indices ?? null;
  return Array.isArray(indexes)
    ? indexes
        .map((index) => Number(index))
        .filter((index) => Number.isInteger(index) && index >= 0)
    : [];
}

export function normalizeCpuAction(raw = {}, context = {}) {
  const warnings = [];
  const { sourceActionField, value } = pickActionField(raw);
  const rawAction = value == null ? null : String(value);
  let action = normalizeToken(value);
  const legalActions = normalizeLegalActions(context.legalActions);
  const hasLegalActions = legalActions.length > 0;
  const toCall = Number(context.toCall) || 0;
  const fixedLimit = context.fixedLimit === true;
  const discardIndexes = normalizeDiscardIndexes(raw);
  const drawCountRaw = raw.drawCount ?? raw.draw_count ?? raw.count ?? null;
  const drawCount = drawCountRaw != null && Number.isFinite(Number(drawCountRaw))
    ? Math.max(0, Number(drawCountRaw))
    : action === "pat"
      ? 0
      : discardIndexes.length > 0
        ? discardIndexes.length
        : null;

  let valid = Boolean(action && CANONICAL_ACTIONS.has(action));
  let fallbackReason = null;

  if (valid && fixedLimit && action === "bet" && hasLegalActions && !legalActions.includes("bet")) {
    if (legalActions.includes("raise")) {
      action = "raise";
      warnings.push("bet-alias-normalized-to-raise");
    }
  }
  if (valid && fixedLimit && action === "raise" && hasLegalActions && !legalActions.includes("raise")) {
    if (toCall <= 0 && legalActions.includes("bet")) {
      action = "bet";
      warnings.push("raise-alias-normalized-to-bet");
    }
  }

  if (!valid) {
    fallbackReason = "CPU_ACTION_INVALID_AFTER_NORMALIZATION";
  }

  const legal = valid && (!hasLegalActions || legalActions.includes(action));
  if (valid && !legal) {
    fallbackReason = "CPU_ACTION_ILLEGAL_AFTER_NORMALIZATION";
  }

  return {
    action: valid ? action : null,
    amount: Number.isFinite(Number(raw.amount)) ? Number(raw.amount) : undefined,
    drawCount,
    discardIndexes,
    reason: raw.reason ?? raw.decisionReason ?? null,
    decisionSource: raw.decisionSource ?? raw.source ?? raw.strategy ?? null,
    sourceActionField,
    rawAction,
    normalized: true,
    valid,
    legal,
    fallbackReason,
    warnings,
  };
}

export default normalizeCpuAction;
