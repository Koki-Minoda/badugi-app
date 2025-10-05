// src/utils/history_rl.js
// --- Badugi 強化学習用：履歴保存ユーティリティ ---

const HAND_HISTORY_KEY = "badugi_hand_history_v2";

/**
 * プレイ履歴を1局ごとに保存する
 * @param {Object} params
 * @param {Object} params.state - 状態（手札やポットなど）
 * @param {string} params.action - 行動（FOLD/CALL/RAISE/DRAW など）
 * @param {number} params.reward - 報酬（1: 勝ち, 0: 引分, -1: 負け）
 */
export function saveRLHandHistory({ state, action, reward }) {
  const entry = {
    timestamp: Date.now(),
    state,
    action,
    reward,
  };

  const existing = JSON.parse(localStorage.getItem(HAND_HISTORY_KEY) || "[]");
  existing.push(entry);
  localStorage.setItem(HAND_HISTORY_KEY, JSON.stringify(existing));
}

export function getAllRLHandHistories() {
  return JSON.parse(localStorage.getItem(HAND_HISTORY_KEY) || "[]");
}

export function exportRLHistoryAsJSONL() {
  const histories = getAllRLHandHistories();
  return histories.map((h) => JSON.stringify(h)).join("\n");
}

export function clearRLHandHistories() {
  localStorage.removeItem(HAND_HISTORY_KEY);
}
