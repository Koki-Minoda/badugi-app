const API_BASE_RAW = import.meta.env?.VITE_API_BASE ?? "/api";
const API_BASE = API_BASE_RAW.endsWith("/api")
  ? API_BASE_RAW
  : `${API_BASE_RAW.replace(/\/$/, "")}/api`;

const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

function buildApiBaseUrl() {
  if (ABSOLUTE_URL_REGEX.test(API_BASE)) return API_BASE;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${API_BASE}`;
  }
  return API_BASE;
}

async function getJson(path) {
  const response = await fetch(`${buildApiBaseUrl()}${path}`);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail ?? data?.message ?? data?.error ?? response.statusText;
    throw new Error(`Variant API failed ${response.status}: ${detail}`);
  }
  return data;
}

export async function fetchVariants() {
  return getJson("/variants");
}

export async function fetchVariant(variantKey) {
  if (!variantKey) {
    throw new Error("variantKey is required");
  }
  return getJson(`/variants/${encodeURIComponent(variantKey)}`);
}
