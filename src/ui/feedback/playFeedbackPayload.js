import { buildPostMatchFollowUpSummary } from "../../games/badugi/analysis/followUpAnalyzer.js";

export const MIN_FEEDBACK_HANDS = 30;
const MIXED_SCOPE_VALUES = new Set(["all", "mixed", "session", "10game", "tournament"]);

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getSeatIndex(entry = {}) {
  return entry.seat ?? entry.seatIndex ?? entry.index ?? null;
}

function isHeroSeat(entry = {}, heroSeat = 0) {
  const seatIndex = getSeatIndex(entry);
  return seatIndex === heroSeat || entry.isHero === true || entry.hero === true;
}

function normalizeActionType(action = {}) {
  return String(action.type ?? action.action ?? "").toLowerCase();
}

function normalizeVariantPrefix(variantId = "unknown") {
  const value = String(variantId ?? "unknown").trim();
  if (!value || value === "unknown") return "UNK";
  if (value.toLowerCase() === "badugi") return "B";
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8) || "UNK";
}

function getHandVariantId(hand = {}) {
  return String(hand.variantId ?? hand.variantKey ?? hand.gameId ?? hand.metadata?.variantId ?? "unknown");
}

function getHandVariantName(hand = {}) {
  return String(
    hand.variantName ??
      hand.gameName ??
      hand.metadata?.variantName ??
      getHandVariantId(hand),
  );
}

function normalizeFeedbackScopeValue(scope = "mixed") {
  if (scope && typeof scope === "object") {
    if (scope.type === "variant") return `variant:${scope.variantId ?? scope.id ?? "unknown"}`;
    return String(scope.value ?? scope.type ?? "mixed");
  }
  const value = String(scope ?? "mixed").trim();
  return value || "mixed";
}

function parseFeedbackScope(scope = "mixed") {
  const value = normalizeFeedbackScopeValue(scope);
  if (value.startsWith("variant:")) {
    return { value, type: "variant", variantId: value.slice("variant:".length) };
  }
  if (MIXED_SCOPE_VALUES.has(value.toLowerCase()) || value.endsWith(":mixed")) {
    return { value, type: "mixed", variantId: null };
  }
  return { value: `variant:${value}`, type: "variant", variantId: value };
}

export function filterHandsForFeedbackScope(hands = [], variantScope = "mixed") {
  const safeHands = Array.isArray(hands) ? hands : [];
  const scope = parseFeedbackScope(variantScope);
  if (scope.type !== "variant") return safeHands;
  return safeHands.filter((hand) => getHandVariantId(hand) === scope.variantId);
}

export function createFeedbackScopeOptions(hands = [], { mode = "cash", tournamentId = null } = {}) {
  const safeHands = Array.isArray(hands) ? hands : [];
  const variants = new Map();
  safeHands.forEach((hand) => {
    const variantId = getHandVariantId(hand);
    const current = variants.get(variantId) ?? {
      value: `variant:${variantId}`,
      type: "variant",
      variantId,
      label: getHandVariantName(hand),
      handCount: 0,
    };
    current.handCount += 1;
    variants.set(variantId, current);
  });

  const mixedValue = mode === "tournament" && tournamentId ? `tournament:${tournamentId}:mixed` : "mixed";
  const mixedLabel = variants.size > 1
    ? mode === "tournament"
      ? "Tournament / 全ゲーム"
      : "Mixed session / 全ゲーム"
    : "All hands";
  return [
    {
      value: mixedValue,
      type: "mixed",
      variantId: null,
      label: mixedLabel,
      handCount: safeHands.length,
    },
    ...[...variants.values()].sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

function actionSeq(action = {}) {
  const seq = Number(action.actionSeq ?? action.seq ?? action.sequence);
  return Number.isInteger(seq) && seq > 0 ? seq : null;
}

function collectHeroActions(hand = {}, heroSeat = 0) {
  const seatEntry = (Array.isArray(hand.seats) ? hand.seats : []).find((seat) =>
    isHeroSeat(seat, heroSeat),
  );
  if (Array.isArray(seatEntry?.actions)) return seatEntry.actions;
  return (Array.isArray(hand.actions) ? hand.actions : []).filter((action) =>
    isHeroSeat(action, heroSeat),
  );
}

function collectHeroResult(hand = {}, heroSeat = 0) {
  const pots = Array.isArray(hand.pots) ? hand.pots : [];
  let won = 0;
  let showdown = false;
  let allIn = false;
  let splitPot = false;

  pots.forEach((pot) => {
    const winners = Array.isArray(pot.winners) ? pot.winners : Array.isArray(pot.payouts) ? pot.payouts : [];
    if (winners.length > 1) splitPot = true;
    winners.forEach((winner) => {
      if (isHeroSeat(winner, heroSeat)) {
        won += toNumber(winner.amount ?? winner.payout ?? winner.chips, 0);
      }
    });
  });

  (Array.isArray(hand.seats) ? hand.seats : []).forEach((seat) => {
    if (!isHeroSeat(seat, heroSeat)) return;
    showdown = showdown || Boolean(seat.handLabel || seat.evaluation || seat.finalLowRanks);
    allIn = allIn || Boolean(seat.allIn || seat.isAllIn || toNumber(seat.allInAmount, 0) > 0);
  });

  collectHeroActions(hand, heroSeat).forEach((action) => {
    const type = normalizeActionType(action);
    showdown = showdown || action.street === "SHOWDOWN";
    allIn = allIn || type === "all-in" || type === "allin" || action.allIn === true;
  });

  return { won, showdown, allIn, splitPot };
}

function buildSituationReference({
  hand = {},
  heroSeat = 0,
  index = 0,
  reason = "key-hand",
} = {}) {
  const variantId = hand.variantId ?? hand.variantKey ?? hand.gameId ?? "unknown";
  const actions = collectHeroActions(hand, heroSeat);
  const primaryAction = actions[actions.length - 1] ?? {};
  const seqs = actions.map(actionSeq).filter((seq) => seq !== null);
  const actionSeqRange = seqs.length
    ? { start: Math.min(...seqs), end: Math.max(...seqs) }
    : null;
  const result = collectHeroResult(hand, heroSeat);
  const pot = toNumber(hand.pot ?? hand.totalPot ?? hand.result?.totalPot, 0);
  const stackDepth = toNumber(primaryAction.stack ?? primaryAction.stackBefore ?? hand.heroStack ?? hand.stack, 0);
  return {
    situationId: `${normalizeVariantPrefix(variantId)}-${String(index + 1).padStart(2, "0")}`,
    reason,
    handId: hand.handId ?? hand.id ?? null,
    variantId,
    actionSeqRange,
    street: primaryAction.street ?? primaryAction.phase ?? hand.street ?? null,
    seatIndex: getSeatIndex(primaryAction) ?? heroSeat,
    position: primaryAction.position ?? primaryAction.pos ?? hand.heroPosition ?? null,
    heroAction: normalizeActionType(primaryAction) || null,
    toCall: toNumber(primaryAction.toCall ?? primaryAction.metadata?.betInfo?.toCall, 0),
    currentBet: toNumber(primaryAction.currentBet ?? primaryAction.metadata?.betInfo?.currentBet, 0),
    pot,
    stackDepth,
    resultDelta: toNumber(hand.heroNet ?? hand.net ?? hand.result?.heroNet, result.won),
  };
}

function buildKeyHandReferences(hands = [], { heroSeat = 0 } = {}) {
  const candidates = new Map();
  const addCandidate = (hand, reason) => {
    const id = hand?.handId ?? hand?.id;
    if (!id || candidates.has(id)) return;
    candidates.set(id, { hand, reason });
  };

  [...hands]
    .sort((a, b) =>
      Math.abs(toNumber(b.heroNet ?? b.net ?? b.result?.heroNet, 0)) -
      Math.abs(toNumber(a.heroNet ?? a.net ?? a.result?.heroNet, 0)),
    )
    .slice(0, 6)
    .forEach((hand) => addCandidate(hand, "large-result"));

  hands.forEach((hand) => {
    const result = collectHeroResult(hand, heroSeat);
    if (result.allIn) addCandidate(hand, "all-in");
    if (result.splitPot) addCandidate(hand, "split-pot");
    if (result.showdown) addCandidate(hand, "showdown");
  });

  return [...candidates.values()].slice(0, 12).map((entry, index) =>
    buildSituationReference({
      hand: entry.hand,
      heroSeat,
      index,
      reason: entry.reason,
    }),
  );
}

function summarizeHands(hands = [], { heroSeat = 0 } = {}) {
  const summary = {
    hands: hands.length,
    vpipHands: 0,
    pfrHands: 0,
    showdownHands: 0,
    allInHands: 0,
    splitPotHands: 0,
    netChips: 0,
    variants: {},
    issueCounts: {},
    topIssues: [],
  };

  const situationByHandId = new Map(
    buildKeyHandReferences(hands, { heroSeat }).map((entry) => [entry.handId, entry]),
  );

  hands.forEach((hand) => {
    const actions = collectHeroActions(hand, heroSeat);
    const actionTypes = actions.map(normalizeActionType);
    const putMoneyInVoluntarily = actionTypes.some((type) =>
      ["bet", "raise", "call", "all-in", "allin"].includes(type),
    );
    const raisedPreDraw = actions.some((action) => {
      const type = normalizeActionType(action);
      const street = String(action.street ?? action.phase ?? "").toUpperCase();
      return ["raise", "bet", "all-in", "allin"].includes(type) && (street === "BET" || street === "PREFLOP" || street === "");
    });
    if (putMoneyInVoluntarily) summary.vpipHands += 1;
    if (raisedPreDraw) summary.pfrHands += 1;

    const result = collectHeroResult(hand, heroSeat);
    if (result.showdown) summary.showdownHands += 1;
    if (result.allIn) summary.allInHands += 1;
    if (result.splitPot) summary.splitPotHands += 1;
    summary.netChips += toNumber(hand.heroNet ?? hand.net ?? hand.result?.heroNet, result.won);

    const variant = hand.variantId ?? hand.variantKey ?? hand.gameId ?? "unknown";
    summary.variants[variant] = (summary.variants[variant] ?? 0) + 1;

    const followUp = buildPostMatchFollowUpSummary(hand, { heroOnly: true });
    followUp.issues.slice(0, 3).forEach((issue) => {
      const situationRef =
        situationByHandId.get(hand.handId ?? hand.id) ??
        buildSituationReference({
          hand,
          heroSeat,
          index: summary.topIssues.length,
          reason: "follow-up-issue",
        });
      summary.issueCounts[issue.type] = (summary.issueCounts[issue.type] ?? 0) + 1;
      summary.topIssues.push({
        situationId: situationRef.situationId,
        handId: hand.handId ?? null,
        actionSeqRange: situationRef.actionSeqRange,
        type: issue.type,
        severity: issue.severity,
        street: issue.street,
        detail: issue.detail,
      });
    });
  });

  summary.vpip = summary.hands ? summary.vpipHands / summary.hands : 0;
  summary.pfr = summary.hands ? summary.pfrHands / summary.hands : 0;
  summary.showdownRate = summary.hands ? summary.showdownHands / summary.hands : 0;
  summary.allInRate = summary.hands ? summary.allInHands / summary.hands : 0;
  summary.splitPotRate = summary.hands ? summary.splitPotHands / summary.hands : 0;
  summary.topIssues = summary.topIssues.slice(0, 12);
  return summary;
}

function summarizeTournament(tournament = {}) {
  const buyIn = toNumber(tournament.buyIn ?? tournament.entryFee ?? tournament.entry, 0);
  const prize = toNumber(tournament.prize ?? tournament.payout, 0);
  return {
    tournamentId: tournament.tournamentId ?? tournament.id ?? null,
    finish: tournament.finish ?? tournament.placement ?? null,
    buyIn,
    prize,
    roi: buyIn ? (prize - buyIn) / buyIn : null,
    reason: tournament.reason ?? null,
  };
}

export function buildPlayFeedbackPayload({
  hands = [],
  mode = "cash",
  variantScope = "all",
  heroSeat = 0,
  tournament = null,
  minHands = MIN_FEEDBACK_HANDS,
} = {}) {
  const sourceHands = Array.isArray(hands) ? hands : [];
  const safeHands = filterHandsForFeedbackScope(sourceHands, variantScope);
  const parsedScope = parseFeedbackScope(variantScope);
  if (safeHands.length < minHands) {
    return {
      eligible: false,
      reason: "not_enough_hands",
      minHands,
      handCount: safeHands.length,
      sourceHandCount: sourceHands.length,
      variantScope: parsedScope.value,
      payload: null,
    };
  }

  const handSummary = summarizeHands(safeHands, { heroSeat });
  const tournamentSummary = tournament ? summarizeTournament(tournament) : null;
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode,
    variantScope: parsedScope.value,
    feedbackScope: {
      value: parsedScope.value,
      type: parsedScope.type,
      variantId: parsedScope.variantId,
      sourceHandCount: sourceHands.length,
      handCount: safeHands.length,
    },
    minHands,
    handCount: safeHands.length,
    heroSeat,
    summary: {
      ...handSummary,
      tournament: tournamentSummary,
      roi: tournamentSummary?.roi ?? null,
    },
    keyHands: buildKeyHandReferences(safeHands, { heroSeat }),
    promptContext: {
      requestedOutput: [
        "良かった点",
        "悪かった点",
        "ROI/獲得チップに影響した仮説",
        "次回の具体的な改善方針",
      ],
      constraints: [
        "30ハンド未満のセッションは評価しない",
        "variant別の判断差を分けて扱う",
        "all-in, split pot, showdown結果を重視する",
      ],
    },
  };

  return {
    eligible: true,
    reason: "eligible",
    minHands,
    handCount: safeHands.length,
    sourceHandCount: sourceHands.length,
    variantScope: parsedScope.value,
    payload,
  };
}

export default buildPlayFeedbackPayload;
