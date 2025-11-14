const STORAGE_KEY = "rl_hand_histories_v1";

export function saveRLHandHistory(record) {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const line = JSON.stringify(record);
    const payload = existing && existing.length ? `${existing}\n${line}` : line;
    localStorage.setItem(STORAGE_KEY, payload);
    console.log("[SAVE_RL] appended record");
  } catch (e) {
    console.error("[SAVE_RL] failed to save:", e);
  }
}

export function getAllRLHandHistories() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return data
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (e) {
    console.error("[SAVE_RL] Failed to parse existing data:", e);
    return [];
  }
}

export function exportRLHistoryAsJSONL() {
  try {
    const payload = localStorage.getItem(STORAGE_KEY) ?? "";
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `badugi_rl_${new Date().toISOString().slice(0, 19)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    const lineCount = payload ? payload.split("\n").filter(Boolean).length : 0;
    console.log(`[SAVE_RL] exported ${lineCount} records as JSONL`);
  } catch (e) {
    console.error("[SAVE_RL] export failed:", e);
  }
}
