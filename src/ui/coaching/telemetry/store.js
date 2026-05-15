import { createCoachingTelemetryEvent, validateCoachingTelemetryEvent } from "./schema.js";

export const DEFAULT_COACHING_TELEMETRY_STORAGE_KEY = "mgx.preview.coaching.telemetry";

function safeStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function deterministicOrder(events = []) {
  return [...events].sort((a, b) => {
    const seqDiff = Number(a.sequence ?? 0) - Number(b.sequence ?? 0);
    if (seqDiff !== 0) return seqDiff;
    return String(a.timestamp ?? "").localeCompare(String(b.timestamp ?? ""));
  });
}

export function createCoachingTelemetryStore({
  persist = false,
  storageKey = DEFAULT_COACHING_TELEMETRY_STORAGE_KEY,
  clock = () => new Date().toISOString(),
  sessionId = "preview-session",
} = {}) {
  let events = [];
  let sequence = 0;

  const writePersisted = () => {
    if (!persist) return;
    const storage = safeStorage();
    if (!storage) return;
    storage.setItem(storageKey, JSON.stringify(deterministicOrder(events)));
  };

  const hydrate = () => {
    if (!persist) return [];
    const storage = safeStorage();
    if (!storage) return [];
    try {
      const parsed = JSON.parse(storage.getItem(storageKey) ?? "[]");
      events = Array.isArray(parsed) ? deterministicOrder(parsed) : [];
      sequence = events.reduce((max, event) => Math.max(max, Number(event.sequence ?? 0)), 0);
      return getEvents();
    } catch {
      events = [];
      sequence = 0;
      return [];
    }
  };

  const record = (eventOrInput = {}) => {
    const event = eventOrInput.type
      ? createCoachingTelemetryEvent({
          timestamp: eventOrInput.timestamp ?? clock(),
          sessionId: eventOrInput.sessionId ?? sessionId,
          ...eventOrInput,
        })
      : createCoachingTelemetryEvent({
          timestamp: clock(),
          sessionId,
          ...eventOrInput,
        });
    const validated = validateCoachingTelemetryEvent(event);
    if (!validated.valid) {
      throw new Error(`Invalid coaching telemetry event: ${validated.errors.join(",")}`);
    }
    const stored = {
      ...event,
      sequence: sequence + 1,
    };
    sequence += 1;
    events.push(stored);
    writePersisted();
    return stored;
  };

  const getEvents = () => deterministicOrder(events);

  const clear = () => {
    events = [];
    sequence = 0;
    if (persist) {
      const storage = safeStorage();
      storage?.removeItem(storageKey);
    }
  };

  const exportJson = () => JSON.stringify({ previewOnly: true, events: getEvents() }, null, 2);

  return {
    hydrate,
    record,
    getEvents,
    clear,
    exportJson,
    storageKey,
    persist,
  };
}

export const defaultCoachingTelemetryStore = createCoachingTelemetryStore();
