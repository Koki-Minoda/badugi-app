import { evaluateBadugi } from "../../games/badugi/utils/badugiEvaluator.js";
import { normalizeCpuAction } from "../normalizeCpuAction.js";

const PRESSURE_ACTIONS = new Set(["BET", "RAISE"]);
const PASSIVE_ACTIONS = new Set(["CHECK", "CALL"]);

function normalizeAction(action) {
  const raw =
    typeof action === "string"
      ? action
      : action?.type ?? action?.action ?? action?.selectedAction ?? action?.finalAction ?? "UNKNOWN";
  const upper = String(raw).trim().toUpperCase();
  if (upper === "RAISE") return "RAISE";
  if (upper === "BET") return "BET";
  if (upper === "CALL") return "CALL";
  if (upper === "CHECK") return "CHECK";
  if (upper === "FOLD") return "FOLD";
  if (upper === "DRAW" || upper.startsWith("DRAW") || upper === "PAT") return "DRAW";
  return upper || "UNKNOWN";
}

function normalizeLegalActions(legalActions = []) {
  return Array.isArray(legalActions)
    ? legalActions.map((entry) => normalizeAction(entry?.type ?? entry)).filter(Boolean)
    : [];
}

function handStrengthFromEvaluation(evaluation) {
  const count = Number(evaluation?.count ?? evaluation?.ranks?.length ?? 0) || 0;
  const kicker = Number(evaluation?.kicker ?? Math.max(...(evaluation?.ranks ?? [13]))) || 13;
  if (count >= 4 && kicker <= 7) return "made-badugi-strong";
  if (count >= 4 && kicker <= 10) return "made-badugi-medium";
  if (count >= 4) return "made-badugi-rough";
  if (count === 3 && kicker <= 7) return "strong-3-card";
  if (count === 3) return "medium-3-card";
  if (count === 2) return "weak-2-card";
  return "trash";
}

function strengthScore(evaluation) {
  const count = Number(evaluation?.count ?? evaluation?.ranks?.length ?? 0) || 0;
  const kicker = Number(evaluation?.kicker ?? Math.max(...(evaluation?.ranks ?? [13]))) || 13;
  if (count >= 4) return Math.max(0.55, 1 - (kicker - 4) * 0.055);
  if (count === 3) return Math.max(0.3, 0.72 - (kicker - 4) * 0.045);
  if (count === 2) return 0.25;
  return 0.08;
}

function equityBucket(score) {
  if (score >= 0.9) return "premium";
  if (score >= 0.75) return "strong";
  if (score >= 0.58) return "medium";
  if (score >= 0.35) return "thin";
  return "weak";
}

function isBetPhase(phase) {
  return String(phase ?? "").toUpperCase() === "BET";
}

function hasPressureLegal(legalActions = []) {
  const legal = normalizeLegalActions(legalActions);
  return legal.some((action) => PRESSURE_ACTIONS.has(action));
}

function isPressureAction(action) {
  return PRESSURE_ACTIONS.has(normalizeAction(action));
}

export function buildBadugiValueTelemetryFields({
  hand = [],
  phase = null,
  drawRound = 0,
  betRound = 0,
  legalActions = [],
  toCall = 0,
  activeOpponents = 1,
  headsUp = null,
  drawCount = null,
} = {}) {
  const evaluation = evaluateBadugi(Array.isArray(hand) ? hand : []);
  const score = strengthScore(evaluation);
  const madeBadugi = Number(evaluation?.count ?? 0) >= 4;
  const estimatedDrawCount = Number.isFinite(Number(drawCount))
    ? Number(drawCount)
    : Math.max(0, 4 - Number(evaluation?.count ?? 0));
  const legalPressure = hasPressureLegal(legalActions);
  const resolvedHeadsUp =
    typeof headsUp === "boolean" ? headsUp : Math.max(0, Number(activeOpponents) || 0) <= 1;
  const finalBetRound = Math.max(Number(drawRound) || 0, Number(betRound) || 0) >= 3;
  const noBetToCall = Math.max(0, Number(toCall) || 0) === 0;
  const bucket = handStrengthFromEvaluation(evaluation);
  const valueBetOpportunity =
    isBetPhase(phase) &&
    noBetToCall &&
    legalPressure &&
    (bucket === "made-badugi-strong" ||
      bucket === "made-badugi-medium" ||
      (finalBetRound && bucket === "made-badugi-rough"));
  const aggressionOpportunity =
    isBetPhase(phase) &&
    legalPressure &&
    (valueBetOpportunity ||
      (resolvedHeadsUp && noBetToCall && bucket === "strong-3-card") ||
      (!noBetToCall && bucket === "made-badugi-strong"));

  return {
    handStrengthBucket: bucket,
    madeBadugi,
    patState: estimatedDrawCount <= 0 ? "pat" : `draw-${estimatedDrawCount}`,
    drawCount: estimatedDrawCount,
    streetStrengthEstimate: Math.round(score * 1000) / 1000,
    aggressionOpportunity,
    valueBetOpportunity,
    showdownEquityBucket: equityBucket(score),
    headsUp: resolvedHeadsUp,
  };
}

export function classifyBadugiValueDecision({
  telemetry = {},
  finalAction = null,
  legalActions = [],
  drawRound = 0,
  betRound = 0,
  toCall = 0,
} = {}) {
  const action = normalizeAction(finalAction);
  const classifications = [];
  const finalBetRound = Math.max(Number(drawRound) || 0, Number(betRound) || 0) >= 3;
  const legalPressure = hasPressureLegal(legalActions);
  const passive = PASSIVE_ACTIONS.has(action);
  const pressure = isPressureAction(action);
  const bucket = telemetry.handStrengthBucket ?? "unknown";
  const noBetToCall = Math.max(0, Number(toCall) || 0) === 0;

  if (telemetry.valueBetOpportunity && !pressure) {
    classifications.push("VALUE_BET_MISSED");
  }
  if (telemetry.aggressionOpportunity && !pressure && legalPressure) {
    classifications.push("PRESSURE_MISSING");
  }
  if (telemetry.valueBetOpportunity && action === "CHECK") {
    classifications.push("OVER_PASSIVE_CHECK");
  }
  if (finalBetRound && telemetry.madeBadugi && passive && legalPressure) {
    classifications.push("TOO_NIT_SHOWDOWN_LINE");
  }
  if (bucket === "made-badugi-medium" && noBetToCall && action === "CHECK" && legalPressure) {
    classifications.push("NO_THIN_VALUE");
  }
  if (telemetry.headsUp && telemetry.aggressionOpportunity && !pressure && legalPressure) {
    classifications.push("NO_HEADS_UP_PRESSURE");
  }
  return [...new Set(classifications)];
}

function buildScenario({
  id,
  label,
  hand,
  phase = "BET",
  drawRound = 3,
  betRound = 3,
  legalActions = ["CHECK", "RAISE"],
  toCall = 0,
  activeOpponents = 1,
  capped = false,
  positionAdvantage = true,
}) {
  return {
    id,
    label,
    hand,
    phase,
    drawRound,
    betRound,
    legalActions,
    toCall,
    activeOpponents,
    capped,
    positionAdvantage,
    telemetry: buildBadugiValueTelemetryFields({
      hand,
      phase,
      drawRound,
      betRound,
      legalActions,
      toCall,
      activeOpponents,
    }),
  };
}

export function buildBadugiValuePressureScenarios() {
  return [
    buildScenario({
      id: "made-wheel-final-open-hu",
      label: "made 4-card Badugi final HU open",
      hand: ["AS", "2D", "3C", "4H"],
    }),
    buildScenario({
      id: "made-seven-pat-vs-draw",
      label: "pat 7 Badugi before final draw HU",
      hand: ["AS", "2D", "4C", "7H"],
      drawRound: 2,
      betRound: 2,
    }),
    buildScenario({
      id: "made-nine-thin-final-open-hu",
      label: "medium 9 Badugi thin final value",
      hand: ["2S", "4D", "6C", "9H"],
    }),
    buildScenario({
      id: "made-six-facing-final-bet-hu",
      label: "made 6 Badugi facing final bet",
      hand: ["AS", "2D", "3C", "6H"],
      legalActions: ["FOLD", "CALL", "RAISE"],
      toCall: 40,
    }),
    buildScenario({
      id: "strong-three-card-hu-pressure",
      label: "strong 3-card Badugi HU pressure",
      hand: ["AS", "2D", "3S", "KH"],
      drawRound: 1,
      betRound: 1,
    }),
    buildScenario({
      id: "capped-made-badugi-no-raise",
      label: "capped made Badugi with no pressure action legal",
      hand: ["AS", "2D", "5C", "8H"],
      legalActions: ["CHECK", "CALL"],
      capped: true,
    }),
  ];
}

function heuristicDecision(scenario) {
  const canPressure = hasPressureLegal(scenario.legalActions);
  const bucket = scenario.telemetry.handStrengthBucket;
  const finalRound = Math.max(Number(scenario.drawRound) || 0, Number(scenario.betRound) || 0) >= 3;
  const action =
    canPressure &&
    (bucket === "made-badugi-strong" ||
      bucket === "made-badugi-medium" ||
      (finalRound && bucket === "made-badugi-rough"))
      ? "RAISE"
      : scenario.toCall > 0
        ? "CALL"
        : "CHECK";
  return {
    decisionSource: "heuristic",
    selectedAction: action,
    rawAction: action,
    reason: action === "RAISE" ? "audit-heuristic-value-pressure" : "audit-heuristic-continue",
    adapterMismatch: false,
  };
}

function proOverlayRuntimeDecision(scenario) {
  const bucket = scenario.telemetry.handStrengthBucket;
  const rawAction =
    hasPressureLegal(scenario.legalActions) &&
    (bucket === "made-badugi-strong" || bucket === "made-badugi-medium")
      ? "RAISE"
      : scenario.toCall > 0
        ? "CALL"
        : "CHECK";
  const normalized = normalizeCpuAction(
    {
      type: rawAction,
      source: "pro-overlay",
      reason:
        rawAction === "RAISE"
          ? "audit-pro-overlay-raw-value-pressure"
          : "audit-pro-overlay-raw-continue",
    },
    {
      phase: "BET",
      legalActions: scenario.legalActions,
      toCall: scenario.toCall,
      fixedLimit: true,
    },
  );
  const selectedAction =
    normalized.legal && normalized.action
      ? normalizeAction(normalized.action)
      : scenario.toCall > 0
        ? "CALL"
        : "CHECK";
  return {
    decisionSource: "pro-overlay",
    selectedAction,
    rawAction,
    reason: rawAction === "RAISE" ? "audit-pro-overlay-raw-value-pressure" : "audit-pro-overlay-raw-continue",
    adapterMismatch: false,
    sourceActionField: normalized.sourceActionField,
    normalizedAction: normalized.action ? normalizeAction(normalized.action) : "UNKNOWN",
    normalizationWarnings: normalized.warnings,
    fallbackReason: normalized.fallbackReason,
  };
}

function fallbackDecision(scenario) {
  return {
    decisionSource: "fallback",
    selectedAction: scenario.toCall > 0 ? "CALL" : "CHECK",
    rawAction: scenario.toCall > 0 ? "CALL" : "CHECK",
    reason: "deterministic-passive-fallback",
    adapterMismatch: false,
  };
}

function decideForPath(pathId, scenario) {
  if (pathId === "heuristic") return heuristicDecision(scenario);
  if (pathId === "pro-overlay") return proOverlayRuntimeDecision(scenario);
  if (pathId === "fallback") return fallbackDecision(scenario);
  throw new Error(`Unknown Badugi value audit path: ${pathId}`);
}

function initMetrics(pathId) {
  return {
    pathId,
    decisions: 0,
    vpipActions: 0,
    pfrActions: 0,
    folds: 0,
    calls: 0,
    checks: 0,
    pressureActions: 0,
    valueBetOpportunities: 0,
    valueBetActions: 0,
    missedValue: 0,
    headsUpPressureOpportunities: 0,
    headsUpPressureActions: 0,
    meaningfulDecisions: 0,
    adapterMismatches: 0,
    classifications: {},
  };
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function finalizeMetrics(metrics) {
  const decisions = Math.max(1, metrics.decisions);
  const valueOpps = Math.max(1, metrics.valueBetOpportunities);
  const huOpps = Math.max(1, metrics.headsUpPressureOpportunities);
  return {
    ...metrics,
    vpip: metrics.vpipActions / decisions,
    pfr: metrics.pfrActions / decisions,
    foldRate: metrics.folds / decisions,
    aggressionFrequency: metrics.pressureActions / decisions,
    valueBetFrequency: metrics.valueBetActions / valueOpps,
    headsUpPressureFrequency: metrics.headsUpPressureActions / huOpps,
    meaningfulDecisionDensity: metrics.meaningfulDecisions / decisions,
  };
}

export function summarizeBadugiValueAuditRows(rows = []) {
  const byPath = new Map();
  rows.forEach((row) => {
    const metrics = byPath.get(row.pathId) ?? initMetrics(row.pathId);
    const action = normalizeAction(row.selectedAction);
    metrics.decisions += 1;
    if (["CALL", "BET", "RAISE"].includes(action)) metrics.vpipActions += 1;
    if (PRESSURE_ACTIONS.has(action)) {
      metrics.pfrActions += 1;
      metrics.pressureActions += 1;
    }
    if (action === "FOLD") metrics.folds += 1;
    if (action === "CALL") metrics.calls += 1;
    if (action === "CHECK") metrics.checks += 1;
    if (row.telemetry?.valueBetOpportunity) {
      metrics.valueBetOpportunities += 1;
      if (PRESSURE_ACTIONS.has(action)) metrics.valueBetActions += 1;
    }
    if (row.telemetry?.headsUp && row.telemetry?.aggressionOpportunity) {
      metrics.headsUpPressureOpportunities += 1;
      if (PRESSURE_ACTIONS.has(action)) metrics.headsUpPressureActions += 1;
    }
    if (!["CHECK", "FOLD", "UNKNOWN"].includes(action)) metrics.meaningfulDecisions += 1;
    if (row.adapterMismatch) metrics.adapterMismatches += 1;
    row.classifications.forEach((classification) => increment(metrics.classifications, classification));
    byPath.set(row.pathId, metrics);
  });
  return [...byPath.values()].map(finalizeMetrics);
}

export function runBadugiValueBetAudit({ paths = ["heuristic", "pro-overlay", "fallback"] } = {}) {
  const scenarios = buildBadugiValuePressureScenarios();
  const rows = [];
  for (const pathId of paths) {
    for (const scenario of scenarios) {
      const decision = decideForPath(pathId, scenario);
      const classifications = classifyBadugiValueDecision({
        telemetry: scenario.telemetry,
        finalAction: decision.selectedAction,
        legalActions: scenario.legalActions,
        drawRound: scenario.drawRound,
        betRound: scenario.betRound,
        toCall: scenario.toCall,
      });
      rows.push({
        pathId,
        scenarioId: scenario.id,
        label: scenario.label,
        decisionSource: decision.decisionSource,
        rawAction: decision.rawAction,
        selectedAction: decision.selectedAction,
        reason: decision.reason,
        adapterMismatch: decision.adapterMismatch,
        sourceActionField: decision.sourceActionField ?? null,
        normalizedAction: decision.normalizedAction ?? null,
        normalizationWarnings: decision.normalizationWarnings ?? [],
        fallbackReason: decision.fallbackReason ?? null,
        legalActions: normalizeLegalActions(scenario.legalActions),
        toCall: scenario.toCall,
        drawRound: scenario.drawRound,
        betRound: scenario.betRound,
        headsUp: scenario.telemetry.headsUp,
        capped: scenario.capped,
        telemetry: scenario.telemetry,
        classifications,
      });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    scope: "Badugi value betting and action-pressure audit; no strategy tuning.",
    scenarios: scenarios.map(({ hand: _hand, ...scenario }) => scenario),
    rows,
    comparison: summarizeBadugiValueAuditRows(rows),
  };
}

export { normalizeAction };
