import {
  buildCpuDecisionTraceRow,
  classifyDecisionSource,
  normalizeCpuActionType,
} from "./cpuDecisionTraceCore.js";

export const CPU_DECISION_METADATA_VERSION = 1;
export const BADUGI_VALUE_TELEMETRY_FIELDS = Object.freeze([
  "handStrengthBucket",
  "madeBadugi",
  "patState",
  "drawCount",
  "streetStrengthEstimate",
  "aggressionOpportunity",
  "valueBetOpportunity",
  "showdownEquityBucket",
]);

const VALID_SOURCES = new Set([
  "heuristic",
  "pro-overlay",
  "rl",
  "fallback",
  "random",
  "forced",
  "unknown",
]);

function normalizeString(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function normalizeSource(value) {
  const source = normalizeString(value, "unknown");
  if (VALID_SOURCES.has(source)) return source;
  if (source.includes("pro") || source.includes("overlay")) return "pro-overlay";
  if (source.includes("fallback")) return "fallback";
  if (source.includes("heuristic") || source.includes("ruleBased")) return "heuristic";
  if (source.includes("random")) return "random";
  if (source.includes("rl")) return "rl";
  return source || "unknown";
}

function normalizeLegalActions(legalActions) {
  if (!Array.isArray(legalActions)) return [];
  return [
    ...new Set(
      legalActions
        .map((entry) => normalizeCpuActionType(entry?.type ?? entry))
        .filter((entry) => entry && entry !== "unknown"),
    ),
  ];
}

function findMetadataValue(metadata = {}, keys = []) {
  for (const key of keys) {
    if (metadata?.[key] !== undefined && metadata?.[key] !== null) return metadata[key];
  }
  for (const value of Object.values(metadata ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = findMetadataValue(value, keys);
      if (nested !== undefined && nested !== null) return nested;
    }
  }
  return null;
}

function isCpuSeat(seatSnapshot = {}, explicit = null) {
  if (explicit !== null && explicit !== undefined) return Boolean(explicit);
  const type = String(seatSnapshot?.seatType ?? seatSnapshot?.playerType ?? "").toLowerCase();
  return Boolean(
    seatSnapshot?.isCPU ||
      seatSnapshot?.isCpu ||
      seatSnapshot?.cpuCharacterId ||
      type.includes("cpu") ||
      type.includes("bot"),
  );
}

function normalizePolicy(value) {
  const raw = normalizeString(value, "unknown");
  if (!raw) return "unknown";
  if (["standard", "pro", "iron", "unknown"].includes(raw)) return raw;
  return raw;
}

export function buildCpuDecisionTelemetry({
  sessionId = null,
  mode = "cash",
  variantId = null,
  actorSeat = null,
  seatSnapshot = {},
  phase = null,
  drawRound = null,
  betRound = null,
  actionType = null,
  metadata = {},
  toCall = null,
  currentBet = null,
  pot = null,
  stack = null,
  canRaise = null,
  aiTier = null,
  cpuPolicy = null,
  explicitIsCpu = null,
} = {}) {
  const isCpu = isCpuSeat(seatSnapshot, explicitIsCpu);
  if (!isCpu) return null;

  const nestedDecision = metadata?.cpuDecision ?? {};
  let legalActions = normalizeLegalActions(
    metadata?.legalActions ??
      nestedDecision?.legalActions ??
      findMetadataValue(metadata, ["legalActions", "legal_actions"]),
  );
  const selectedAction = normalizeCpuActionType(
    metadata?.selectedAction ??
      nestedDecision?.selectedAction ??
      metadata?.type ??
      actionType ??
      "unknown",
  );
  const finalAction = normalizeCpuActionType(
    metadata?.finalAction ??
      nestedDecision?.finalAction ??
      actionType ??
      selectedAction,
  );
  const tier = normalizeString(
    metadata?.aiTier ?? metadata?.tierId ?? nestedDecision?.aiTier ?? aiTier,
    "unknown",
  );
  const policy = normalizePolicy(
    metadata?.cpuPolicy ?? metadata?.tierId ?? nestedDecision?.cpuPolicy ?? cpuPolicy ?? tier,
  );
  const rawSource =
    metadata?.decisionSource ??
    metadata?.decision_source ??
    nestedDecision?.decisionSource ??
    findMetadataValue(metadata, ["decisionSource", "decision_source", "source", "strategy"]);
  const decisionSource = normalizeSource(
    rawSource ? classifyDecisionSource({ decisionSource: rawSource }, tier) : "unknown",
  );
  const fallbackReason =
    metadata?.fallbackReason ??
    metadata?.fallback_reason ??
    nestedDecision?.fallbackReason ??
    findMetadataValue(metadata, ["fallbackReason", "fallback_reason"]) ??
    null;
  const handStrengthBucket =
    metadata?.handStrengthBucket ??
    nestedDecision?.handStrengthBucket ??
    findMetadataValue(metadata, ["handStrengthBucket"]) ??
    "unknown";
  const madeBadugi =
    metadata?.madeBadugi ??
    nestedDecision?.madeBadugi ??
    findMetadataValue(metadata, ["madeBadugi"]);
  const patState =
    metadata?.patState ??
    nestedDecision?.patState ??
    findMetadataValue(metadata, ["patState"]) ??
    null;
  const drawCount =
    metadata?.drawCount ??
    metadata?.drawInfo?.drawCount ??
    nestedDecision?.drawCount ??
    findMetadataValue(metadata, ["drawCount"]);
  const streetStrengthEstimate =
    metadata?.streetStrengthEstimate ??
    nestedDecision?.streetStrengthEstimate ??
    findMetadataValue(metadata, ["streetStrengthEstimate"]);
  const aggressionOpportunity =
    metadata?.aggressionOpportunity ??
    nestedDecision?.aggressionOpportunity ??
    findMetadataValue(metadata, ["aggressionOpportunity"]);
  const valueBetOpportunity =
    metadata?.valueBetOpportunity ??
    nestedDecision?.valueBetOpportunity ??
    findMetadataValue(metadata, ["valueBetOpportunity"]);
  const showdownEquityBucket =
    metadata?.showdownEquityBucket ??
    nestedDecision?.showdownEquityBucket ??
    findMetadataValue(metadata, ["showdownEquityBucket"]) ??
    null;
  const rawDecisionType = metadata?.rawDecisionType ?? nestedDecision?.rawDecisionType ?? null;
  const rawDecisionAction = metadata?.rawDecisionAction ?? nestedDecision?.rawDecisionAction ?? null;
  const rawActionSource =
    metadata?.rawActionSource ??
    metadata?.sourceActionField ??
    nestedDecision?.rawActionSource ??
    nestedDecision?.sourceActionField ??
    null;
  const normalizedAction =
    metadata?.normalizedAction ?? nestedDecision?.normalizedAction ?? null;
  const normalizationWarnings = Array.isArray(metadata?.normalizationWarnings)
    ? metadata.normalizationWarnings
    : Array.isArray(nestedDecision?.normalizationWarnings)
      ? nestedDecision.normalizationWarnings
      : [];
  const legacyTypeAliasNormalized =
    metadata?.legacyTypeAliasNormalized === true || nestedDecision?.legacyTypeAliasNormalized === true;
  const adapterMismatch = metadata?.adapterMismatch === true || nestedDecision?.adapterMismatch === true;
  const resolvedCanRaise =
    typeof canRaise === "boolean"
      ? canRaise
      : legalActions.includes("raise") || legalActions.includes("bet");
  if (legalActions.length === 0) {
    const street = String(phase ?? "").toUpperCase();
    if (street === "DRAW") {
      legalActions = ["draw"];
    } else if (street === "BET") {
      legalActions = ["fold", Number(toCall) > 0 ? "call" : "check"];
      if (resolvedCanRaise) legalActions.push("raise");
    }
  }

  const row = buildCpuDecisionTraceRow({
    handId: metadata?.handId ?? null,
    variantId,
    mode,
    seat: actorSeat,
    position: seatSnapshot?.position ?? seatSnapshot?.role ?? null,
    phase,
    drawRound,
    betRound,
    legalActions,
    selectedAction,
    finalAction,
    decisionSource,
    fallbackReason,
    metadata: {
      ...metadata,
      handStrengthBucket,
      madeBadugi: madeBadugi === true,
      patState,
      drawCount,
      streetStrengthEstimate,
      aggressionOpportunity: aggressionOpportunity === true,
      valueBetOpportunity: valueBetOpportunity === true,
      showdownEquityBucket,
      rawDecisionType,
      rawDecisionAction,
      rawActionSource,
      sourceActionField: rawActionSource,
      normalizedAction,
      normalizationWarnings,
      legacyTypeAliasNormalized,
      adapterMismatch,
    },
    toCall: Number(toCall) || 0,
    currentBet: Number(currentBet) || 0,
    pot: Number(pot) || 0,
    stack: Number(stack ?? seatSnapshot?.stack) || 0,
    rlRequestSent: Boolean(metadata?.rlRequestSent ?? metadata?.rlUsed),
    rlResponseValid: Boolean(metadata?.rlResponseValid),
    applySuccess: metadata?.applySuccess !== false,
    illegalActionRejected: Boolean(metadata?.illegalActionRejected),
    forcedFold: Boolean(metadata?.forcedFold),
  });
  row.sessionId = normalizeString(sessionId, "unknown");
  row.actorSeat = Number.isFinite(Number(actorSeat)) ? Number(actorSeat) : null;
  row.isCpu = true;
  row.cpuPolicy = policy;
  row.aiTier = tier;
  row.canRaise = resolvedCanRaise;
  row.madeBadugi = madeBadugi === true;
  row.patState = patState;
  row.drawCount = Number.isFinite(Number(drawCount)) ? Number(drawCount) : row.drawCount;
  row.streetStrengthEstimate = Number.isFinite(Number(streetStrengthEstimate))
    ? Number(streetStrengthEstimate)
    : null;
  row.aggressionOpportunity = aggressionOpportunity === true;
  row.valueBetOpportunity = valueBetOpportunity === true;
  row.showdownEquityBucket = showdownEquityBucket;
  row.rawDecisionType = rawDecisionType;
  row.rawDecisionAction = rawDecisionAction;
  row.rawActionSource = rawActionSource;
  row.sourceActionField = rawActionSource;
  row.normalizedAction = normalizedAction;
  row.normalizationWarnings = normalizationWarnings;
  row.legacyTypeAliasNormalized = legacyTypeAliasNormalized;
  row.adapterMismatch = adapterMismatch;

  return {
    cpuTelemetryVersion: CPU_DECISION_METADATA_VERSION,
    sessionId: normalizeString(sessionId, "unknown"),
    mode: normalizeString(mode, "unknown"),
    variantId: normalizeString(variantId, "unknown"),
    actorSeat: Number.isFinite(Number(actorSeat)) ? Number(actorSeat) : null,
    isCpu: true,
    decisionSource,
    fallbackReason,
    legalActions,
    selectedAction,
    finalAction,
    cpuPolicy: policy,
    aiTier: tier,
    street: normalizeString(phase, "unknown"),
    drawRound: Number.isFinite(Number(drawRound)) ? Number(drawRound) : null,
    betRound: Number.isFinite(Number(betRound)) ? Number(betRound) : null,
    toCall: Number(toCall) || 0,
    canRaise: resolvedCanRaise,
    handStrengthBucket,
    madeBadugi: madeBadugi === true,
    patState,
    drawCount: Number.isFinite(Number(drawCount)) ? Number(drawCount) : null,
    streetStrengthEstimate: Number.isFinite(Number(streetStrengthEstimate))
      ? Number(streetStrengthEstimate)
      : null,
    aggressionOpportunity: aggressionOpportunity === true,
    valueBetOpportunity: valueBetOpportunity === true,
    showdownEquityBucket,
    rawDecisionType,
    rawDecisionAction,
    rawActionSource,
    sourceActionField: rawActionSource,
    normalizedAction,
    normalizationWarnings,
    legacyTypeAliasNormalized,
    adapterMismatch,
    cpuDecision: row,
  };
}

export function mergeCpuDecisionTelemetry(metadata = {}, telemetry = null) {
  if (!telemetry) return metadata;
  const { cpuDecision, ...flat } = telemetry;
  return {
    ...metadata,
    ...flat,
    cpuDecision: {
      ...cpuDecision,
      sessionId: flat.sessionId,
      actorSeat: flat.actorSeat,
      isCpu: true,
      cpuPolicy: flat.cpuPolicy,
      aiTier: flat.aiTier,
      canRaise: flat.canRaise,
    },
  };
}
