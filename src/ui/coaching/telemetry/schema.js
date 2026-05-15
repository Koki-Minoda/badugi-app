export const COACHING_TELEMETRY_EVENT_TYPES = Object.freeze([
  "LESSON_SHOWN",
  "LESSON_OPENED",
  "REPLAY_OPENED",
  "REPLAY_COMPLETED",
  "LESSON_ACKNOWLEDGED",
  "LESSON_DISMISSED",
  "LESSON_HELPFUL",
  "LESSON_NOT_HELPFUL",
]);

const TYPE_SET = new Set(COACHING_TELEMETRY_EVENT_TYPES);

function normalizeDeviceClass(value = "unknown") {
  const normalized = String(value ?? "unknown").toLowerCase();
  if (["mobile", "tablet", "desktop"].includes(normalized)) return normalized;
  return "unknown";
}

function inferDeviceClass() {
  if (typeof window === "undefined") return "unknown";
  const width = Number(window.innerWidth ?? 0);
  if (width > 0 && width <= 480) return "mobile";
  if (width > 0 && width <= 900) return "tablet";
  return "desktop";
}

export function assertCoachingTelemetryEventType(type) {
  if (!TYPE_SET.has(type)) {
    throw new Error(`Unsupported coaching telemetry event type: ${type}`);
  }
}

export function createCoachingTelemetryEvent({
  type,
  lesson = {},
  lessonId = lesson.lessonId,
  replayRef = lesson.replayRef ?? lesson.replayReference ?? null,
  variant = lesson.variantId ?? lesson.variant ?? null,
  timestamp = new Date().toISOString(),
  locale = "jp",
  deviceClass = inferDeviceClass(),
  replayDeterministic = lesson.replayDeterministic ?? lesson.deterministic ?? null,
  actionIndex = lesson.actionIndex ?? null,
  evDelta = lesson.estimatedEVGain ?? lesson.evDelta ?? null,
  severity = lesson.severity ?? null,
  sessionId = "preview-session",
  metadata = {},
} = {}) {
  assertCoachingTelemetryEventType(type);
  return {
    type,
    lessonId: lessonId ?? null,
    replayRef,
    variant,
    timestamp,
    locale,
    deviceClass: normalizeDeviceClass(deviceClass),
    replayDeterministic: replayDeterministic === true,
    actionIndex: Number.isInteger(actionIndex) ? actionIndex : null,
    evDelta: Number.isFinite(Number(evDelta)) ? Number(evDelta) : null,
    severity,
    sessionId,
    previewOnly: true,
    pii: false,
    upload: false,
    metadata,
  };
}

export function validateCoachingTelemetryEvent(event = {}) {
  const errors = [];
  if (!TYPE_SET.has(event.type)) errors.push("invalid-type");
  if (!event.lessonId) errors.push("lesson-id-missing");
  if (!event.sessionId) errors.push("session-id-missing");
  if (event.upload !== false) errors.push("upload-not-disabled");
  if (event.pii !== false) errors.push("pii-not-disabled");
  if (event.previewOnly !== true) errors.push("preview-only-missing");
  if (event.userId || event.email || event.playerName) errors.push("pii-field-present");
  return {
    valid: errors.length === 0,
    errors,
  };
}
