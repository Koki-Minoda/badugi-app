// 履歴保存とJSONL出力ユーティリティ
const STORAGE_KEY = "rl_hand_histories_v1";

// --- 保存 ---
export function saveRLHandHistory(record) {
  try {
    console.log("[SAVE_RL] called with record:", record);
    const all = getAllRLHandHistories();
    all.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    console.log(`[SAVE_RL] saved OK, total: ${all.length}`);
  } catch (e) {
    console.error("[SAVE_RL] failed to save:", e);
  }
}

// --- 取得 ---
export function getAllRLHandHistories() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      console.warn("[SAVE_RL] No existing data found (first save)");
      return [];
    }
    return JSON.parse(data) || [];
  } catch (e) {
    console.error("[SAVE_RL] Failed to parse existing data:", e);
    return [];
  }
}

// --- JSONLとしてエクスポート ---
export function exportRLHistoryAsJSONL() {
  try {
    const all = getAllRLHandHistories();
    const jsonl = all.map((r) => JSON.stringify(r)).join("\n");
    const blob = new Blob([jsonl], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `badugi_rl_${new Date().toISOString().slice(0, 19)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`[SAVE_RL] exported ${all.length} records as JSONL`);
  } catch (e) {
    console.error("[SAVE_RL] export failed:", e);
  }
}
