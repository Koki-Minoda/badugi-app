const ACTION_ALIASES = {
  bet: "raise",
  raise: "raise",
  call: "call",
  check: "check",
  fold: "fold",
  draw: "draw",
  pat: "draw",
};

function normalizeAction(action) {
  const raw =
    typeof action === "string"
      ? action
      : action?.type ?? action?.selectedAction ?? action?.finalAction ?? "unknown";
  return ACTION_ALIASES[String(raw).toLowerCase()] ?? String(raw).toLowerCase();
}

function createEmptyBucket() {
  return {
    decisions: 0,
    folds: 0,
    calls: 0,
    raises: 0,
    checks: 0,
    draws: 0,
    pats: 0,
    opens: 0,
    showdowns: 0,
    legalRaiseSpots: 0,
    legalRaiseFolds: 0,
    fallbackDecisions: 0,
    invalidResponses: 0,
    forcedFolds: 0,
    illegalActionRejections: 0,
    rlRequests: 0,
    rlValidResponses: 0,
    actionCounts: {},
    decisionSources: {},
    fallbackReasons: {},
    handStrengthBuckets: {},
  };
}

function increment(map, key, amount = 1) {
  const normalized = key == null || key === "" ? "unknown" : String(key);
  map[normalized] = (map[normalized] ?? 0) + amount;
}

function accumulate(bucket, row = {}) {
  const action = normalizeAction(row.finalAction ?? row.selectedAction ?? row.action);
  const source = row.decisionSource ?? row.source ?? "unknown";
  const legalActions = Array.isArray(row.legalActions)
    ? row.legalActions.map((entry) => normalizeAction(entry))
    : [];
  const hasLegalRaise = legalActions.includes("raise");
  const isFallback =
    source === "fallback" ||
    source === "random-fallback" ||
    source === "policy-router-fallback" ||
    Boolean(row.fallbackReason);

  bucket.decisions += 1;
  increment(bucket.actionCounts, action);
  increment(bucket.decisionSources, source);
  increment(bucket.handStrengthBuckets, row.handStrengthBucket ?? "unknown");
  if (row.fallbackReason) increment(bucket.fallbackReasons, row.fallbackReason);

  if (action === "fold") bucket.folds += 1;
  if (action === "call") bucket.calls += 1;
  if (action === "raise") bucket.raises += 1;
  if (action === "check") bucket.checks += 1;
  if (action === "draw") bucket.draws += 1;
  if (row.drawCount === 0 || row.pat === true) bucket.pats += 1;
  if (action === "raise" && Number(row.currentBet ?? 0) <= 0) bucket.opens += 1;
  if (row.reachedShowdown || row.event === "showdown") bucket.showdowns += 1;
  if (hasLegalRaise) bucket.legalRaiseSpots += 1;
  if (hasLegalRaise && action === "fold") bucket.legalRaiseFolds += 1;
  if (isFallback) bucket.fallbackDecisions += 1;
  if (row.rlRequestSent) bucket.rlRequests += 1;
  if (row.rlResponseValid) bucket.rlValidResponses += 1;
  if (row.rlRequestSent && !row.rlResponseValid) bucket.invalidResponses += 1;
  if (row.forcedFold) bucket.forcedFolds += 1;
  if (row.illegalActionRejected || row.applySuccess === false) {
    bucket.illegalActionRejections += 1;
  }
}

function finalize(bucket) {
  const decisions = Math.max(1, bucket.decisions);
  return {
    ...bucket,
    foldRate: bucket.folds / decisions,
    callRate: bucket.calls / decisions,
    raiseRate: bucket.raises / decisions,
    openRate: bucket.opens / decisions,
    drawRate: bucket.draws / decisions,
    fallbackRate: bucket.fallbackDecisions / decisions,
    rlValidRate: bucket.rlRequests > 0 ? bucket.rlValidResponses / bucket.rlRequests : null,
  };
}

export function summarizeCpuDecisionTrace(rows = []) {
  const all = createEmptyBucket();
  const byVariant = {};
  const bySource = {};
  const classifications = new Set();

  for (const row of rows) {
    const variantId = row?.variantId ?? "unknown";
    const source = row?.decisionSource ?? row?.source ?? "unknown";
    byVariant[variantId] ??= createEmptyBucket();
    bySource[source] ??= createEmptyBucket();
    accumulate(all, row);
    accumulate(byVariant[variantId], row);
    accumulate(bySource[source], row);
  }

  const finalizedByVariant = Object.fromEntries(
    Object.entries(byVariant).map(([key, value]) => [key, finalize(value)]),
  );
  const finalizedBySource = Object.fromEntries(
    Object.entries(bySource).map(([key, value]) => [key, finalize(value)]),
  );
  const finalizedAll = finalize(all);

  for (const [variantId, bucket] of Object.entries(finalizedByVariant)) {
    if (bucket.decisions > 0 && bucket.fallbackRate === 1) {
      classifications.add(`${variantId}:RL_FALLBACK_ALWAYS_USED`);
    }
    if (bucket.legalRaiseSpots === 0) {
      classifications.add(`${variantId}:LEGAL_ACTIONS_MISSING_RAISE`);
    }
    if (
      bucket.legalRaiseSpots > 0 &&
      (bucket.raises === 0 || (bucket.foldRate > 0.9 && bucket.raiseRate < 0.02))
    ) {
      classifications.add(`${variantId}:CPU_STRATEGY_TOO_NIT`);
    }
    if (bucket.illegalActionRejections > 0 || bucket.forcedFolds > 0) {
      classifications.add(`${variantId}:PROGRESSION_FORCES_FOLD`);
    }
    if (bucket.rlRequests > 0 && bucket.rlValidResponses === 0) {
      classifications.add(`${variantId}:RL_RESPONSE_INVALID`);
    }
  }

  return {
    totalDecisions: finalizedAll.decisions,
    totals: finalizedAll,
    byVariant: finalizedByVariant,
    byDecisionSource: finalizedBySource,
    classifications: [...classifications].sort(),
  };
}

export default summarizeCpuDecisionTrace;
