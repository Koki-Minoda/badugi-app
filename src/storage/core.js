function getDefaultStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function warnStorage(message, error, options = {}) {
  if (options.silent) return;
  if (typeof console === "undefined" || typeof console.warn !== "function") return;
  console.warn(message, error);
}

function resolveStorage(options = {}) {
  return Object.prototype.hasOwnProperty.call(options, "storage")
    ? options.storage
    : getDefaultStorage();
}

export function safeParseJson(raw, fallback = null) {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function safeStringifyJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function isStorageAvailable(storage = getDefaultStorage()) {
  if (!storage) return false;
  const probeKey = "__mgx_storage_probe__";
  try {
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

export function safeGetItem(key, fallback = null, options = {}) {
  const storage = resolveStorage(options);
  if (!storage || !key) return fallback;
  try {
    const raw = storage.getItem(key);
    if (raw == null) return fallback;
    return options.raw === true ? raw : safeParseJson(raw, fallback);
  } catch (error) {
    warnStorage("[storage] failed to read item", error, options);
    return fallback;
  }
}

export function safeSetItem(key, value, options = {}) {
  const storage = resolveStorage(options);
  if (!storage || !key) return false;
  try {
    const payload =
      options.raw === true ? String(value ?? "") : safeStringifyJson(value);
    if (payload == null) return false;
    storage.setItem(key, payload);
    return true;
  } catch (error) {
    warnStorage("[storage] failed to write item", error, options);
    return false;
  }
}

export function safeRemoveItem(key, options = {}) {
  const storage = resolveStorage(options);
  if (!storage || !key) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    warnStorage("[storage] failed to remove item", error, options);
    return false;
  }
}
