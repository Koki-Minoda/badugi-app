export function normalizeActionType(label = "") {
  const lower = String(label).toLowerCase();
  if (lower.startsWith("raise")) return "raise";
  if (lower.startsWith("bet")) return "bet";
  if (lower.startsWith("call")) return "call";
  if (lower.includes("all-in")) return "all-in";
  if (lower.startsWith("check")) return "check";
  if (lower.startsWith("fold")) return "fold";
  if (lower.startsWith("draw")) return "draw";
  if (lower.startsWith("collect")) return "collect";
  if (lower.startsWith("ante")) return "ante";
  if (lower.startsWith("blind")) return "blind";
  if (lower.startsWith("pat")) return "pat";
  return lower.trim() || "action";
}

function extractHandId(entry) {
  if (entry?.handId) return entry.handId;
  const actionId = entry?.metadata?.actionId;
  if (typeof actionId === "string" && actionId.length > 0) {
    const [handId] = actionId.split("|");
    if (handId) return handId;
  }
  return null;
}

function resolveKey(entry, keyBy) {
  if (keyBy === "playerId") {
    return entry?.playerId ?? (entry?.seat != null ? `seat-${entry.seat}` : "table");
  }
  if (keyBy === "seat") {
    return entry?.seat != null ? `seat-${entry.seat}` : "table";
  }
  return entry?.playerId ?? (entry?.seat != null ? `seat-${entry.seat}` : "table");
}

function computePaid(entry) {
  const stackBefore = Number.isFinite(entry?.stackBefore) ? entry.stackBefore : null;
  const stackAfter = Number.isFinite(entry?.stackAfter) ? entry.stackAfter : null;
  if (stackBefore !== null && stackAfter !== null) {
    return Math.max(0, stackBefore - stackAfter);
  }
  if (Number.isFinite(entry?.paid)) return entry.paid;
  const before = Number.isFinite(entry?.betBefore) ? entry.betBefore : 0;
  const after = Number.isFinite(entry?.betAfter) ? entry.betAfter : before;
  return Math.max(0, after - before);
}

export function computeSeatStats(actionLog = [], options = {}) {
  const keyBy = options.keyBy ?? "playerId";
  const stats = {};
  const handsSeen = new Map();
  const vpipHands = new Map();
  const pfrHands = new Map();
  const atsHands = new Map();
  const atsOpportunityHands = new Map();
  const threeBetHands = new Map();
  const threeBetOpportunityHands = new Map();
  const aggroCounts = new Map();
  const callCounts = new Map();
  const streetCounts = new Map();

  const ensure = (key) => {
    if (stats[key]) return;
    stats[key] = {
      hands: 0,
      vpip: 0,
      pfr: 0,
      ats: 0,
      atsOpportunities: 0,
      threeBet: 0,
      threeBetOpportunities: 0,
      af: 0,
      vpipRate: 0,
      pfrRate: 0,
      atsRate: null,
      threeBetRate: null,
      street: {
        flop: { cb: null, fcb: null, ccb: null, rcb: null },
        turn: { cb: null, fcb: null, ccb: null, rcb: null },
        river: { wt: null, wsd: null, taf: null },
      },
    };
    handsSeen.set(key, new Set());
    vpipHands.set(key, new Set());
    pfrHands.set(key, new Set());
    atsHands.set(key, new Set());
    atsOpportunityHands.set(key, new Set());
    threeBetHands.set(key, new Set());
    threeBetOpportunityHands.set(key, new Set());
    aggroCounts.set(key, 0);
    callCounts.set(key, 0);
    streetCounts.set(key, {
      flop: { cb: 0, fcb: 0, ccb: 0, rcb: 0, opportunities: 0 },
      turn: { cb: 0, fcb: 0, ccb: 0, rcb: 0, opportunities: 0 },
      river: { wt: 0, wsd: 0, tafAggro: 0, tafPassive: 0, opportunities: 0 },
    });
  };

  (Array.isArray(actionLog) ? actionLog : []).forEach((entry) => {
    if (!entry) return;
    const key = resolveKey(entry, keyBy);
    ensure(key);
    const handId = extractHandId(entry);
    if (handId) {
      handsSeen.get(key).add(handId);
    }
    if (entry.phase !== "BET") return;
    const actionType = normalizeActionType(entry.action);
    const paid = computePaid(entry);
    const round = Number.isFinite(entry.round) ? entry.round : 0;
    const raiseCountTable = Number.isFinite(entry.raiseCountTable)
      ? entry.raiseCountTable
      : Number.isFinite(entry?.metadata?.raiseCountTable)
      ? entry.metadata.raiseCountTable
      : 0;
    const positionLabel = String(
      entry.positionLabel ?? entry?.metadata?.positionLabel ?? entry?.metadata?.position ?? "",
    ).toUpperCase();
    const isAggressive = paid > 0 && !entry.isForced && ["bet", "raise"].includes(actionType);
    const isCall = paid > 0 && !entry.isForced && actionType === "call";
    if (
      round === 0 &&
      paid > 0 &&
      !entry.isForced &&
      ["call", "bet", "raise"].includes(actionType)
    ) {
      if (handId) vpipHands.get(key).add(handId);
    }
    if (round === 0 && paid > 0 && !entry.isForced && ["bet", "raise"].includes(actionType)) {
      if (handId) pfrHands.get(key).add(handId);
    }
    if (round === 0 && ["BTN", "CO", "SB"].includes(positionLabel)) {
      if (handId) atsOpportunityHands.get(key).add(handId);
      if (isAggressive && handId) atsHands.get(key).add(handId);
    }
    if (round === 0 && actionType === "raise") {
      if (handId) threeBetOpportunityHands.get(key).add(handId);
      if (raiseCountTable >= 2 && handId) threeBetHands.get(key).add(handId);
    }
    if (isAggressive) {
      aggroCounts.set(key, aggroCounts.get(key) + 1);
    }
    if (isCall) {
      callCounts.set(key, callCounts.get(key) + 1);
    }
    const streetBucket =
      round === 1 ? "flop" : round === 2 ? "turn" : round >= 3 ? "river" : null;
    if (streetBucket) {
      const bucket = streetCounts.get(key)[streetBucket];
      bucket.opportunities += 1;
      if (streetBucket === "river") {
        if (["bet", "raise"].includes(actionType)) bucket.tafAggro += 1;
        if (["call", "check"].includes(actionType)) bucket.tafPassive += 1;
        if (["call", "check", "bet", "raise"].includes(actionType)) bucket.wt += 1;
        if (String(entry?.metadata?.showdown ?? "").toLowerCase() === "true") bucket.wsd += 1;
      } else {
        if (["bet", "raise"].includes(actionType)) bucket.cb += 1;
        if (actionType === "fold") bucket.fcb += 1;
        if (actionType === "call") bucket.ccb += 1;
        if (actionType === "raise") bucket.rcb += 1;
      }
    }
  });

  Object.keys(stats).forEach((key) => {
    const hands = handsSeen.get(key)?.size ?? 0;
    const vpip = vpipHands.get(key)?.size ?? 0;
    const pfr = pfrHands.get(key)?.size ?? 0;
    const ats = atsHands.get(key)?.size ?? 0;
    const atsOpportunities = atsOpportunityHands.get(key)?.size ?? 0;
    const threeBet = threeBetHands.get(key)?.size ?? 0;
    const threeBetOpportunities = threeBetOpportunityHands.get(key)?.size ?? 0;
    const aggro = aggroCounts.get(key) ?? 0;
    const calls = callCounts.get(key) ?? 0;
    const streetRaw = streetCounts.get(key);
    const rate = (value, total) => (total > 0 ? value / total : null);
    stats[key] = {
      hands,
      vpip,
      pfr,
      ats,
      atsOpportunities,
      threeBet,
      threeBetOpportunities,
      af: calls === 0 ? aggro : aggro / calls,
      vpipRate: hands > 0 ? vpip / hands : 0,
      pfrRate: hands > 0 ? pfr / hands : 0,
      atsRate: rate(ats, atsOpportunities),
      threeBetRate: rate(threeBet, threeBetOpportunities),
      street: {
        flop: {
          cb: rate(streetRaw.flop.cb, streetRaw.flop.opportunities),
          fcb: rate(streetRaw.flop.fcb, streetRaw.flop.opportunities),
          ccb: rate(streetRaw.flop.ccb, streetRaw.flop.opportunities),
          rcb: rate(streetRaw.flop.rcb, streetRaw.flop.opportunities),
        },
        turn: {
          cb: rate(streetRaw.turn.cb, streetRaw.turn.opportunities),
          fcb: rate(streetRaw.turn.fcb, streetRaw.turn.opportunities),
          ccb: rate(streetRaw.turn.ccb, streetRaw.turn.opportunities),
          rcb: rate(streetRaw.turn.rcb, streetRaw.turn.opportunities),
        },
        river: {
          wt: rate(streetRaw.river.wt, streetRaw.river.opportunities),
          wsd: rate(streetRaw.river.wsd, streetRaw.river.opportunities),
          taf: rate(streetRaw.river.tafAggro, streetRaw.river.tafAggro + streetRaw.river.tafPassive),
        },
      },
    };
  });

  return stats;
}

export function formatStatPercent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${Math.round(value * 100)}`;
}

export function formatStatAf(value) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(1);
}
