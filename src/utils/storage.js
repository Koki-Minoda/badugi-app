// src/utils/storage.js
// ------------------------
// VPIP, PFR などのプレイヤー統計管理

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
