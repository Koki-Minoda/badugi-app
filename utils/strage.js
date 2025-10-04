// Lightweight localStorage helpers with JSON handling + array utils
const PREFIX = "badugi.";

const safeParse = (str, fallback) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

export function getJSON(key, fallback = null) {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw == null) return fallback;
  return safeParse(raw, fallback);
}

export function setJSON(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function pushToArray(key, item, { limit = 500 } = {}) {
  const arr = getJSON(key, []);
  arr.unshift(item);
  if (arr.length > limit) arr.length = limit;
  setJSON(key, arr);
  return arr;
}

export function remove(key) {
  localStorage.removeItem(PREFIX + key);
}

export function migrate(fromKey, toKey) {
  const raw = localStorage.getItem(PREFIX + fromKey);
  if (raw != null && localStorage.getItem(PREFIX + toKey) == null) {
    localStorage.setItem(PREFIX + toKey, raw);
  }
}

// Optional small KV with TTL (for caching derived stats)
export function setWithTTL(key, value, ttlMs) {
  setJSON(key, { v: value, e: Date.now() + ttlMs });
}
export function getWithTTL(key, fallback = null) {
  const wrap = getJSON(key);
  if (!wrap) return fallback;
  if (Date.now() > wrap.e) return fallback;
  return wrap.v;
}
