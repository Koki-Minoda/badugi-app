const STORAGE_KEY = "rl_hand_histories_v1";

export function saveRLHandHistory(record) {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const line = JSON.stringify(record);
    const payload = existing && existing.length ? `${existing}\n${line}` : line;
    localStorage.setItem(STORAGE_KEY, payload);
    const pots = Array.isArray(record?.pots) ? record.pots : [];
    const winners = pots.flatMap((pot) =>
      Array.isArray(pot?.winners)
        ? pot.winners.map((winner) => ({
            seat: winner.seat ?? winner.seatIndex ?? null,
            collect: winner.collect ?? winner.payout ?? 0,
            handLabel: winner.handLabel ?? winner.handName ?? null,
            finalLowRanks: winner.finalLowRanks ?? winner.evaluation?.metadata?.ranks ?? null,
          }))
        : [],
    );
    console.log("[SAVE_RL] appended record", {
      handId: record?.handId ?? record?.hand_id ?? record?.id ?? null,
      variantId: record?.variantId ?? record?.gameId ?? null,
      winner: record?.winner ?? null,
      winners,
      pot: record?.pot ?? pots.reduce((sum, pot) => sum + (pot?.amount ?? 0), 0),
    });
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
