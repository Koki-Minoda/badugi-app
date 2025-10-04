// src/utils/storage.js
// --- 既存: VPIP, PFR などのプレイヤー統計管理 -----------------------------

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
 * ハンド終了時に統計を更新
 */
export function updateStats({ vpip, pfr, winnings }) {
  const stats = loadStats();
  stats.gamesPlayed += 1;
  stats.vpip = (stats.vpip * (stats.gamesPlayed - 1) + vpip) / stats.gamesPlayed;
  stats.pfr = (stats.pfr * (stats.gamesPlayed - 1) + pfr) / stats.gamesPlayed;
  stats.winnings += winnings;
  saveStats(stats);
}

// --- 追加: 汎用 localStorage JSON ヘルパ & 配列ユーティリティ ---------------

const PREFIX = "badugi.";

const safeParse = (str, fallback) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

/**
 * JSON値を取得。存在しなければ fallback を返す
 */
export function getJSON(key, fallback = null) {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw == null) return fallback;
  return safeParse(raw, fallback);
}

/**
 * JSON値を保存
 */
export function setJSON(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

/**
 * 先頭に要素を追加（上限付き）
 */
export function pushToArray(key, item, { limit = 500 } = {}) {
  const arr = getJSON(key, []);
  arr.unshift(item);
  if (arr.length > limit) arr.length = limit;
  setJSON(key, arr);
  return arr;
}

/**
 * キー削除
 */
export function remove(key) {
  localStorage.removeItem(PREFIX + key);
}

/**
 * キー移行（from → to）: 既に to があれば何もしない
 */
export function migrate(fromKey, toKey) {
  const raw = localStorage.getItem(PREFIX + fromKey);
  if (raw != null && localStorage.getItem(PREFIX + toKey) == null) {
    localStorage.setItem(PREFIX + toKey, raw);
  }
}

/**
 * TTL付きキャッシュ
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
