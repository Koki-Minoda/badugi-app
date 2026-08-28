import ChinesePokerController from "./ChinesePokerController.js";

export const CHINESE_HISTORY_STORAGE_KEY = "mgx.chinesePokerHistory.v1";

function stable(value) {
  return JSON.stringify(value);
}

export function replayChinesePokerHistory(history) {
  if (!history || history.variantId !== "chinese_poker" || !Array.isArray(history.seats)) {
    return { valid: false, errors: ["invalid-history"], snapshot: null };
  }
  const deck = history.seats.flatMap((seat) => seat.initialHand ?? []);
  if (history.seats.length < 2 || deck.length !== history.seats.length * 13 || new Set(deck).size !== deck.length) {
    return { valid: false, errors: ["invalid-initial-cards"], snapshot: null };
  }
  try {
    const controller = new ChinesePokerController({
      seats: history.seats.map((seat) => ({
        id: seat.id,
        name: seat.name,
        isHero: seat.isHero,
      })),
      deck,
      shuffle: false,
    });
    controller.startNewHand();
    (history.events ?? [])
      .filter((event) => event?.type === "ROWS_SET")
      .forEach((event) => controller.setRows(event.playerId, event.rows));
    const snapshot = controller.resolveShowdown();
    const errors = [];
    if (stable(snapshot.results) !== stable(history.results)) errors.push("result-mismatch");
    return { valid: errors.length === 0, errors, snapshot };
  } catch (error) {
    return { valid: false, errors: [error?.message ?? "replay-failed"], snapshot: null };
  }
}

export function loadChinesePokerHistory(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(CHINESE_HISTORY_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistChinesePokerHistory(history, storage = globalThis.localStorage) {
  if (!history) return [];
  const withoutDuplicate = loadChinesePokerHistory(storage).filter((entry) => entry?.handId !== history.handId);
  const next = [history, ...withoutDuplicate].slice(0, 50);
  storage?.setItem(CHINESE_HISTORY_STORAGE_KEY, JSON.stringify(next));
  return next;
}
