import path from "node:path";

import { readJson, writeJsonReport } from "../../../ai/iron/coverageAuditUtils.js";

export const COACHING_HISTORY_SCHEMA_VERSION = 1;
export const UNKNOWN_VARIANT_ID = "unknownVariant";
export const DEFAULT_STEP54_HISTORY_STORE_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step54-coaching-history-store.json",
);
export const DEFAULT_STEP55_VARIANT_HISTORY_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/step55-variant-aware-history.json",
);

function normalizeHelpfulState(value = "unset") {
  if (["helpful", "not-helpful", "unset"].includes(value)) return value;
  return "unset";
}

export function normalizeVariantId(value) {
  const variantId = String(value ?? "").trim();
  return variantId || UNKNOWN_VARIANT_ID;
}

export function sortCoachingHistoryEntries(entries = []) {
  return [...entries].sort(
    (a, b) =>
      String(a.timestamp).localeCompare(String(b.timestamp)) ||
      String(a.variantId).localeCompare(String(b.variantId)) ||
      String(a.lessonId).localeCompare(String(b.lessonId)),
  );
}

export function normalizeCoachingHistoryEntry(entry = {}) {
  return {
    schemaVersion: COACHING_HISTORY_SCHEMA_VERSION,
    lessonId: entry.lessonId ?? null,
    variantId: normalizeVariantId(entry.variantId ?? entry.variant),
    lessonTag: entry.lessonTag ?? null,
    severity: entry.severity ?? "low",
    evDelta: Number(entry.evDelta ?? entry.estimatedEVGain ?? 0),
    replayRef: entry.replayRef ?? entry.replayCta?.replayRef ?? null,
    replayUrl: entry.replayUrl ?? entry.replayCta?.href ?? null,
    replayDeterministic: entry.replayDeterministic ?? entry.replayCta?.deterministic ?? false,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    sessionId: entry.sessionId ?? "preview-session",
    source: entry.source ?? "tournament",
    helpfulState: normalizeHelpfulState(entry.helpfulState),
    acknowledged: entry.acknowledged === true,
    replayViewed: entry.replayViewed === true,
    actionFamily: entry.actionFamily ?? `${entry.baselineAction ?? ""}->${entry.recommendedAction ?? ""}`,
    titleJp: entry.titleJp ?? null,
    titleEn: entry.titleEn ?? null,
    jp: entry.jp ?? null,
    en: entry.en ?? null,
    previewOnly: true,
    pii: false,
    upload: false,
  };
}

function readStorage(storage, key) {
  if (!storage || typeof storage.getItem !== "function") return [];
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(storage, key, entries) {
  if (!storage || typeof storage.setItem !== "function") return;
  storage.setItem(key, JSON.stringify(entries));
}

export function createCoachingHistoryStore({
  storage = null,
  storageKey = "mgx.preview.coachingHistory",
  initialEntries = [],
} = {}) {
  let entries = sortCoachingHistoryEntries([
    ...readStorage(storage, storageKey),
    ...initialEntries,
  ].map(normalizeCoachingHistoryEntry));

  const persist = () => writeStorage(storage, storageKey, entries);

  return {
    addLesson(entry) {
      const normalized = normalizeCoachingHistoryEntry(entry);
      entries = sortCoachingHistoryEntries([...entries, normalized]);
      persist();
      return normalized;
    },
    updateLesson(lessonId, patch = {}) {
      entries = sortCoachingHistoryEntries(
        entries.map((entry) =>
          entry.lessonId === lessonId ? normalizeCoachingHistoryEntry({ ...entry, ...patch }) : entry,
        ),
      );
      persist();
      return entries.find((entry) => entry.lessonId === lessonId) ?? null;
    },
    markHelpful(lessonId, helpful = true) {
      return this.updateLesson(lessonId, { helpfulState: helpful ? "helpful" : "not-helpful" });
    },
    markAcknowledged(lessonId) {
      return this.updateLesson(lessonId, { acknowledged: true });
    },
    markReplayViewed(lessonId) {
      return this.updateLesson(lessonId, { replayViewed: true });
    },
    getEntries() {
      return [...entries];
    },
    clear() {
      entries = [];
      persist();
    },
    exportJson() {
      return JSON.stringify({
        schemaVersion: COACHING_HISTORY_SCHEMA_VERSION,
        previewOnly: true,
        entries,
      });
    },
  };
}

export function buildStep55PreviewHistoryEntries({ baseEntries = [] } = {}) {
  const supplemental = [
    {
      lessonId: "D02_SECOND_PRESSURE_PC3_A",
      variantId: "D02",
      lessonTag: "second-pressure",
      severity: "medium",
      evDelta: 14.5,
      replayRef: null,
      replayUrl: null,
      replayDeterministic: false,
      timestamp: "2026-05-15T04:02:00.000Z",
      sessionId: "step55-preview-session-c",
      source: "tournament",
      helpfulState: "helpful",
      acknowledged: true,
      replayViewed: false,
      actionFamily: "CALL->RAISE",
      titleJp: "D02で圧力に対する判断を見直す場面",
      titleEn: "D02 pressure response review",
      jp: "D02では、二度目の圧力に対して受け身になりすぎない判断を見直しましょう。",
      en: "In D02, review spots where second-pressure decisions become too passive.",
    },
    {
      lessonId: "D02_SECOND_PRESSURE_PC3_B",
      variantId: "D02",
      lessonTag: "second-pressure",
      severity: "low",
      evDelta: 11.2,
      replayRef: null,
      replayUrl: null,
      replayDeterministic: false,
      timestamp: "2026-05-15T04:03:00.000Z",
      sessionId: "step55-preview-session-d",
      source: "tournament",
      helpfulState: "unset",
      acknowledged: true,
      replayViewed: false,
      actionFamily: "CALL->RAISE",
      titleJp: "D02の圧力判断をもう一度確認する場面",
      titleEn: "Another D02 pressure review spot",
      jp: "似たD02の圧力場面が繰り返し出ています。次回は相手の圧力に対する返し方を意識しましょう。",
      en: "A similar D02 pressure spot repeated. Next time, pay attention to how you respond to pressure.",
    },
  ];
  const byId = new Map();
  [...baseEntries, ...supplemental].forEach((entry) => {
    const normalized = normalizeCoachingHistoryEntry(entry);
    byId.set(normalized.lessonId, normalized);
  });
  return sortCoachingHistoryEntries([...byId.values()]);
}

export function buildVariantAwareCoachingHistorySummary({ entries = [], migrationApplied = false } = {}) {
  const normalized = sortCoachingHistoryEntries(entries.map(normalizeCoachingHistoryEntry));
  const variants = [...new Set(normalized.map((entry) => entry.variantId))].sort();
  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: COACHING_HISTORY_SCHEMA_VERSION,
    previewOnly: true,
    backendUpload: false,
    networkTelemetry: false,
    pii: false,
    deterministicOrdering: true,
    totalLessons: normalized.length,
    sessions: [...new Set(normalized.map((entry) => entry.sessionId))].sort(),
    variants,
    unknownVariantCount: normalized.filter((entry) => entry.variantId === UNKNOWN_VARIANT_ID).length,
    migrationApplied,
    entries: normalized,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildVariantAwareCoachingHistory({
  historyPath = DEFAULT_STEP54_HISTORY_STORE_OUTPUT_PATH,
  outputPath = DEFAULT_STEP55_VARIANT_HISTORY_OUTPUT_PATH,
  entries = null,
} = {}) {
  const history = entries ? { entries } : await readJson(historyPath);
  const report = buildVariantAwareCoachingHistorySummary({
    entries: buildStep55PreviewHistoryEntries({ baseEntries: history.entries ?? [] }),
    migrationApplied: (history.entries ?? []).some((entry) => !entry.variantId),
  });
  return writeJsonReport(outputPath, report);
}

export function buildCoachingHistoryStorePreviewSummary({ summary = {} } = {}) {
  const baseTimestamp = Date.parse("2026-05-15T04:00:00.000Z");
  const lessons = summary.topLessons ?? [];
  const initialEntries = lessons.map((lesson, index) =>
    normalizeCoachingHistoryEntry({
      ...lesson,
      evDelta: lesson.estimatedEVGain,
      timestamp: new Date(baseTimestamp + index * 60000).toISOString(),
      sessionId: index === 0 ? "step54-preview-session-a" : "step54-preview-session-b",
      source: "tournament",
      helpfulState: "helpful",
      acknowledged: true,
      replayViewed: true,
    }),
  );
  const store = createCoachingHistoryStore({ initialEntries });
  const entries = store.getEntries();
  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: COACHING_HISTORY_SCHEMA_VERSION,
    previewOnly: true,
    backendUpload: false,
    networkTelemetry: false,
    pii: false,
    deterministicOrdering: true,
    totalLessons: entries.length,
    sessionCount: new Set(entries.map((entry) => entry.sessionId)).size,
    entries,
    canClear: true,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildCoachingHistoryStorePreview({
  summaryPath = path.resolve("reports/ai-iron/step53-coaching-summary-viewmodel.json"),
  outputPath = DEFAULT_STEP54_HISTORY_STORE_OUTPUT_PATH,
  summary = null,
} = {}) {
  const report = buildCoachingHistoryStorePreviewSummary({ summary: summary ?? (await readJson(summaryPath)) });
  return writeJsonReport(outputPath, report);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildCoachingHistoryStorePreview();
  console.log(JSON.stringify(report, null, 2));
}
