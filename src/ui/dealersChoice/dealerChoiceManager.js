const QUEUE_KEY = "dealersChoice.queue";
const MODE_KEY = "dealersChoice.mode";

export const DEFAULT_DEALER_CHOICE_POOL = [
  "B01", // NL Hold'em
  "B02", // FL Hold'em
  "B05", // Pot-Limit Omaha
  "B06", // PLO8
  "B09", // FLO8
  "ST1", // Stud
  "ST2", // Stud8
  "ST3", // Razz
  "D01", // 2-7 Triple Draw
  "D03", // Badugi
  "S01", // 2-7 Single Draw
];

function readQueue() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (err) {
    console.warn("[DealerChoice] Failed to read queue", err);
    return [];
  }
}

function writeQueue(queue) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn("[DealerChoice] Failed to persist queue", err);
  }
}

export function getDealerChoiceQueue() {
  return readQueue();
}

export function enqueueDealerChoiceVariant(variantId) {
  if (!variantId) return getDealerChoiceQueue();
  const next = [...readQueue(), variantId];
  writeQueue(next);
  return next;
}

export function shiftDealerChoiceVariant() {
  const queue = readQueue();
  const queueLengthBefore = queue.length;
  if (!queueLengthBefore) {
    return { variantId: null, remaining: 0, queueLengthBefore: 0 };
  }
  const [variantId, ...rest] = queue;
  writeQueue(rest);
  return {
    variantId,
    remaining: rest.length,
    queueLengthBefore,
  };
}

export function peekDealerChoiceQueue() {
  const queue = readQueue();
  return queue.length ? queue[0] : null;
}

export function clearDealerChoiceQueue() {
  writeQueue([]);
  return [];
}

export function setDealerChoiceModeActive(active) {
  if (typeof window === "undefined") return;
  try {
    if (active) {
      window.localStorage.setItem(MODE_KEY, "1");
    } else {
      window.localStorage.removeItem(MODE_KEY);
    }
  } catch (err) {
    console.warn("[DealerChoice] Failed to persist mode flag", err);
  }
}

export function isDealerChoiceModeActive() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MODE_KEY) === "1";
  } catch (err) {
    return false;
  }
}

export function disableDealerChoiceMode(reason = "system") {
  const wasActive = isDealerChoiceModeActive();
  if (!wasActive) return false;
  setDealerChoiceModeActive(false);
  const hasWindow = typeof window !== "undefined";
  const EventCtor =
    (hasWindow && typeof window.CustomEvent === "function" && window.CustomEvent) ||
    (typeof CustomEvent === "function" ? CustomEvent : null);
  if (hasWindow && typeof window.dispatchEvent === "function" && EventCtor) {
    try {
      window.dispatchEvent(
        new EventCtor("dealersChoice:disabled", {
          detail: { reason, timestamp: Date.now() },
        })
      );
    } catch (err) {
      console.warn("[DealerChoice] Failed to dispatch disabled event", err);
    }
  }
  return true;
}
