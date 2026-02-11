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
  const aggroCounts = new Map();
  const callCounts = new Map();

  (Array.isArray(actionLog) ? actionLog : []).forEach((entry) => {
    if (!entry) return;
    const key = resolveKey(entry, keyBy);
    if (!stats[key]) {
      stats[key] = { hands: 0, vpip: 0, pfr: 0, af: 0, vpipRate: 0, pfrRate: 0 };
      handsSeen.set(key, new Set());
      vpipHands.set(key, new Set());
      pfrHands.set(key, new Set());
      aggroCounts.set(key, 0);
      callCounts.set(key, 0);
    }
    const handId = extractHandId(entry);
    if (handId) {
      handsSeen.get(key).add(handId);
    }
    if (entry.phase !== "BET") return;
    const actionType = normalizeActionType(entry.action);
    const paid = computePaid(entry);
    const round = Number.isFinite(entry.round) ? entry.round : 0;
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
    if (paid > 0 && !entry.isForced && ["bet", "raise"].includes(actionType)) {
      aggroCounts.set(key, aggroCounts.get(key) + 1);
    }
    if (paid > 0 && !entry.isForced && actionType === "call") {
      callCounts.set(key, callCounts.get(key) + 1);
    }
  });

  Object.keys(stats).forEach((key) => {
    const hands = handsSeen.get(key)?.size ?? 0;
    const vpip = vpipHands.get(key)?.size ?? 0;
    const pfr = pfrHands.get(key)?.size ?? 0;
    const aggro = aggroCounts.get(key) ?? 0;
    const calls = callCounts.get(key) ?? 0;
    stats[key] = {
      hands,
      vpip,
      pfr,
      af: calls === 0 ? aggro : aggro / calls,
      vpipRate: hands > 0 ? vpip / hands : 0,
      pfrRate: hands > 0 ? pfr / hands : 0,
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
