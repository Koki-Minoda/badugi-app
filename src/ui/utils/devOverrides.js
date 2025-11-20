const TIER_OVERRIDE_KEY = "dev.aiTierOverride";
const KPI_SNAPSHOT_KEY = "dev.aiKpiSnapshot";
const P2P_CAPTURE_KEY = "dev.p2pCapture";

export const DEV_EVENTS = Object.freeze({
  tierOverrideChanged: "badugi:devTierOverrideChanged",
  kpiSnapshot: "badugi:devAiKpiSnapshot",
  p2pCaptureChanged: "badugi:devP2pCaptureChanged",
});

function getLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function dispatchDevEvent(name, detail) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (err) {
    // ignore
  }
}

export function loadAiTierOverride() {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const value = storage.getItem(TIER_OVERRIDE_KEY);
    return value || null;
  } catch (err) {
    return null;
  }
}

export function persistAiTierOverride(nextTierId) {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    if (nextTierId) {
      storage.setItem(TIER_OVERRIDE_KEY, nextTierId);
    } else {
      storage.removeItem(TIER_OVERRIDE_KEY);
    }
  } catch (err) {
    return null;
  }
  dispatchDevEvent(DEV_EVENTS.tierOverrideChanged, nextTierId || null);
  return nextTierId || null;
}

export function loadLastAiKpiSnapshot() {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(KPI_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export function persistAiKpiSnapshot(snapshot) {
  if (!snapshot) return;
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(KPI_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch (err) {
    return;
  }
  dispatchDevEvent(DEV_EVENTS.kpiSnapshot, snapshot);
}

export function loadP2pCaptureFlag() {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    return storage.getItem(P2P_CAPTURE_KEY) === "1";
  } catch (err) {
    return false;
  }
}

export function persistP2pCaptureFlag(enabled) {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    if (enabled) {
      storage.setItem(P2P_CAPTURE_KEY, "1");
    } else {
      storage.removeItem(P2P_CAPTURE_KEY);
    }
  } catch (err) {
    return false;
  }
  dispatchDevEvent(DEV_EVENTS.p2pCaptureChanged, enabled);
  return enabled;
}
