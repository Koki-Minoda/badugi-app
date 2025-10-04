import { pushToArray, getJSON, remove } from "./storage";

const HANDS_KEY = "history.hands";
const TOURNEY_KEY = "history.tournaments";

export function saveHandHistory(hand) {
  if (!hand?.handId) hand.handId = crypto.randomUUID?.() ?? String(Date.now());
  hand.ts ??= Date.now();
  return pushToArray(HANDS_KEY, hand, { limit: 2000 });
}

export function saveTournamentHistory(t) {
  if (!t?.tournamentId) t.tournamentId = crypto.randomUUID?.() ?? String(Date.now());
  t.tsEnd ??= Date.now();
  return pushToArray(TOURNEY_KEY, t, { limit: 500 });
}

export function getHands({ limit = 200, since, until } = {}) {
  let arr = getJSON(HANDS_KEY, []);
  if (since) arr = arr.filter((h) => h.ts >= since);
  if (until) arr = arr.filter((h) => h.ts <= until);
  return arr.slice(0, limit);
}

export function getTournaments({ limit = 200, since, until } = {}) {
  let arr = getJSON(TOURNEY_KEY, []);
  if (since) arr = arr.filter((t) => (t.tsEnd ?? t.tsStart) >= since);
  if (until) arr = arr.filter((t) => (t.tsEnd ?? t.tsStart) <= until);
  return arr.slice(0, limit);
}

export function computeBasicStats() {
  const ts = getTournaments({ limit: 1000 });
  const played = ts.length;
  const itm = ts.filter((t) => t.prize > 0).length;
  const totalBuyIn = ts.reduce((s, t) => s + (t.buyIn ?? 0), 0);
  const totalPrize = ts.reduce((s, t) => s + (t.prize ?? 0), 0);
  const roi = totalBuyIn ? (totalPrize - totalBuyIn) / totalBuyIn : 0;
  const best = ts.reduce((b, t) => (t.finish && (!b || t.finish < b)) ? t.finish : b, null);
  return {
    tournaments: played,
    itmCount: itm,
    itmRate: played ? itm / played : 0,
    totalBuyIn,
    totalPrize,
    roi,
    bestFinish: best,
  };
}

export function clearHands() {
  remove(HANDS_KEY);
}
export function clearTournaments() {
  remove(TOURNEY_KEY);
}
