function getDefaultStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function isQuotaExceededError(error) {
  if (!error) return false;
  const name = String(error.name ?? "");
  const code = Number(error.code);
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014
  );
}

export function createQuotaAwareSetter({ storage, onQuotaExceeded } = {}) {
  const targetStorage =
    arguments[0] && Object.prototype.hasOwnProperty.call(arguments[0], "storage")
      ? storage
      : getDefaultStorage();
  return function quotaAwareSetItem(key, value) {
    if (!targetStorage || !key) return false;
    try {
      targetStorage.setItem(key, value);
      return true;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        onQuotaExceeded?.(error, { key, value });
      } else if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn("[storage] setItem failed", error);
      }
      return false;
    }
  };
}
