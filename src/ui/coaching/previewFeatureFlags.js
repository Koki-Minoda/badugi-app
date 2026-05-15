export const COACHING_PREVIEW_STORAGE_KEY = "mgx.preview.coaching.enabled";
export const COACHING_PREVIEW_QUERY_KEY = "mgxPreview";

function safeWindow() {
  return typeof window === "undefined" ? null : window;
}

export function safePreviewStorage(win = safeWindow()) {
  if (!win?.localStorage) return null;
  try {
    const testKey = "__mgx_preview_flag_probe__";
    win.localStorage.setItem(testKey, "1");
    win.localStorage.removeItem(testKey);
    return win.localStorage;
  } catch {
    return null;
  }
}

function envFlagEnabled(env = import.meta.env) {
  const value = String(env?.VITE_MGX_COACHING_PREVIEW ?? "").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function queryFlagEnabled(search = safeWindow()?.location?.search ?? "") {
  try {
    const params = new URLSearchParams(search);
    const value = String(params.get(COACHING_PREVIEW_QUERY_KEY) ?? "").toLowerCase();
    return value === "coaching" || value === "dashboard" || value === "1" || value === "true";
  } catch {
    return false;
  }
}

function storageFlagEnabled(storage = safePreviewStorage()) {
  if (!storage) return false;
  try {
    return String(storage.getItem(COACHING_PREVIEW_STORAGE_KEY) ?? "").toLowerCase() === "true";
  } catch {
    return false;
  }
}

export function isCoachingPreviewEnabled({
  env = import.meta.env,
  search = safeWindow()?.location?.search ?? "",
  storage = safePreviewStorage(),
} = {}) {
  return envFlagEnabled(env) || queryFlagEnabled(search) || storageFlagEnabled(storage);
}

export function setCoachingPreviewFlag(value, storage = safePreviewStorage()) {
  if (!storage) {
    return {
      previewOnly: true,
      persisted: false,
      enabled: Boolean(value),
      reason: "storage-unavailable",
    };
  }
  try {
    if (value) storage.setItem(COACHING_PREVIEW_STORAGE_KEY, "true");
    else storage.removeItem(COACHING_PREVIEW_STORAGE_KEY);
    return {
      previewOnly: true,
      persisted: true,
      enabled: Boolean(value),
      reason: "ok",
    };
  } catch {
    return {
      previewOnly: true,
      persisted: false,
      enabled: Boolean(value),
      reason: "storage-write-failed",
    };
  }
}

export function buildPreviewFeatureFlagAudit({ enabled = isCoachingPreviewEnabled() } = {}) {
  return {
    previewOnly: true,
    coachingPreviewEnabled: Boolean(enabled),
    productionRoutingChanged: false,
    liveRLMutation: false,
    externalAnalytics: false,
    networkTelemetry: false,
    hiddenTelemetry: false,
  };
}
