const API_BASE_RAW = import.meta.env?.VITE_API_BASE ?? "/api";
const API_BASE = API_BASE_RAW.endsWith("/api")
  ? API_BASE_RAW
  : `${API_BASE_RAW.replace(/\/$/, "")}/api`;
const AUTH_STORAGE_KEY = "mgx_auth";

function normalizeTokenType(tokenType) {
  const normalized = String(tokenType ?? "Bearer").trim();
  return normalized.toLowerCase() === "bearer" ? "Bearer" : normalized;
}

function readStoredAuth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken) return null;
    return {
      accessToken: parsed.accessToken,
      tokenType: normalizeTokenType(parsed.tokenType),
    };
  } catch {
    return null;
  }
}

async function parseError(response) {
  const data = await response.json().catch(() => null);
  const detail = data?.detail ?? data?.message ?? data?.error;
  if (Array.isArray(detail)) {
    return detail.map((entry) => entry?.msg ?? JSON.stringify(entry)).join(" ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return detail || `Request failed (${response.status})`;
}

export async function requestPlayFeedback(payload, authOverride = null) {
  const auth = authOverride ?? readStoredAuth();
  if (!auth?.accessToken) {
    throw new Error("login_required");
  }
  const response = await fetch(`${API_BASE}/analysis/play-feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `${normalizeTokenType(auth.tokenType)} ${auth.accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function fetchPlayFeedbackResults({ sessionKey = null, limit = 20 } = {}, authOverride = null) {
  const auth = authOverride ?? readStoredAuth();
  if (!auth?.accessToken) {
    throw new Error("login_required");
  }
  const params = new URLSearchParams();
  if (sessionKey) params.set("session_key", sessionKey);
  params.set("limit", String(limit));
  const response = await fetch(`${API_BASE}/analysis/play-feedback/results?${params.toString()}`, {
    headers: {
      Authorization: `${normalizeTokenType(auth.tokenType)} ${auth.accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export function hasStoredFeedbackAuth() {
  return Boolean(readStoredAuth()?.accessToken);
}
