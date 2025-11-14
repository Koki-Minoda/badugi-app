// src/utils/storage.js
// --- Legacy player stat helpers (VPIP, PFR, winnings) ---

const STATS_KEY = "badugi_player_stats_v1";

export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw
      ? JSON.parse(raw)
      : { gamesPlayed: 0, vpip: 0, pfr: 0, winnings: 0 };
  } catch {
    return { gamesPlayed: 0, vpip: 0, pfr: 0, winnings: 0 };
  }
}

export function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

/**
 * Update aggregate stats at the end of a hand.
 */
export function updateStats({ vpip, pfr, winnings }) {
  const stats = loadStats();
  stats.gamesPlayed += 1;
  stats.vpip = (stats.vpip * (stats.gamesPlayed - 1) + vpip) / stats.gamesPlayed;
  stats.pfr = (stats.pfr * (stats.gamesPlayed - 1) + pfr) / stats.gamesPlayed;
  stats.winnings += winnings;
  saveStats(stats);
}

// --- Generic localStorage JSON helpers ------------------------------------

const PREFIX = "badugi.";

const safeParse = (str, fallback) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

/**
 * Read a JSON value or return the fallback.
 */
export function getJSON(key, fallback = null) {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw == null) return fallback;
  return safeParse(raw, fallback);
}

/**
 * Save a JSON value.
 */
export function setJSON(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

/**
 * Prepend an item and trim by limit.
 */
export function pushToArray(key, item, { limit = 500 } = {}) {
  const arr = getJSON(key, []);
  arr.unshift(item);
  if (arr.length > limit) arr.length = limit;
  setJSON(key, arr);
  return arr;
}

/**
 * Remove a key.
 */
export function remove(key) {
  localStorage.removeItem(PREFIX + key);
}

/**
 * Migrate one key to another if the destination is empty.
 */
export function migrate(fromKey, toKey) {
  const raw = localStorage.getItem(PREFIX + fromKey);
  if (raw != null && localStorage.getItem(PREFIX + toKey) == null) {
    localStorage.setItem(PREFIX + toKey, raw);
  }
}

/**
 * TTL-aware setters/getters.
 */
export function setWithTTL(key, value, ttlMs) {
  setJSON(key, { v: value, e: Date.now() + ttlMs });
}

export function getWithTTL(key, fallback = null) {
  const wrap = getJSON(key);
  if (!wrap) return fallback;
  if (Date.now() > wrap.e) return fallback;
  return wrap.v;
}

