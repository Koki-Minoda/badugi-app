const EVENT_KEY = "history.systemEvents";
const MAX_EVENTS = 200;

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getSystemEvents() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(EVENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("[SystemLog] Failed to load events", err);
    return [];
  }
}

export function appendSystemEvent(event) {
  if (!hasStorage()) return [];
  const base = getSystemEvents();
  const entry = {
    id: event?.id ?? `sys-${Date.now()}`,
    timestamp: Date.now(),
    ...event,
  };
  const next = [entry, ...base].slice(0, MAX_EVENTS);
  try {
    window.localStorage.setItem(EVENT_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("[SystemLog] Failed to append event", err);
  }
  return next;
}
