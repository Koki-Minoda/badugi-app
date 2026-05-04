const FEEDBACK_STORAGE_KEY = "mgx.playFeedback.results.v1";
const MAX_FEEDBACK_RESULTS = 20;

function readResults() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FEEDBACK_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeResults(results) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    FEEDBACK_STORAGE_KEY,
    JSON.stringify(results.slice(0, MAX_FEEDBACK_RESULTS)),
  );
}

export function buildFeedbackSessionKey(payload = {}) {
  const tournamentId = payload.summary?.tournament?.tournamentId;
  const mode = payload.mode ?? "cash";
  const scope = payload.variantScope ?? "mixed";
  return [mode, tournamentId ?? "cash", scope].join(":");
}

export function savePlayFeedbackResult({ payload, response }) {
  if (!payload || !response) return null;
  const sessionKey = buildFeedbackSessionKey(payload);
  const entry = {
    id: `${sessionKey}:${Date.now()}`,
    sessionKey,
    createdAt: new Date().toISOString(),
    mode: payload.mode ?? "cash",
    handCount: payload.handCount ?? 0,
    variantScope: payload.variantScope ?? "mixed",
    tournamentId: payload.summary?.tournament?.tournamentId ?? null,
    summary: payload.summary ?? null,
    response,
  };
  const next = [entry, ...readResults().filter((item) => item.id !== entry.id)];
  writeResults(next);
  return entry;
}

export function listPlayFeedbackResults({ sessionKey = null, limit = MAX_FEEDBACK_RESULTS } = {}) {
  const results = readResults();
  const filtered = sessionKey
    ? results.filter((entry) => entry.sessionKey === sessionKey)
    : results;
  return filtered.slice(0, Math.max(1, limit));
}

export function getLatestPlayFeedbackResult(payloadOrKey) {
  const sessionKey =
    typeof payloadOrKey === "string" ? payloadOrKey : buildFeedbackSessionKey(payloadOrKey ?? {});
  return listPlayFeedbackResults({ sessionKey, limit: 1 })[0] ?? null;
}
