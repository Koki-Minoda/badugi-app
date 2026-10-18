import { isQuotaExceededError } from './quota.js';

// Auxiliary training logs are bounded caches. Reclaim those before risking a
// tournament save; never discard replay history, account data or progression.
const DIAGNOSTIC_KEYS = ['rl_hand_histories_v1', 'badugi_human_benchmark_logs_v1'];
const failures = new Set();
const listeners = new Set();
export const subscribeSaveFailures = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const hasSaveFailure = () => failures.size > 0;
function publish(key, failed) {
  const before = hasSaveFailure();
  if (failed) failures.add(key); else failures.delete(key);
  if (before !== hasSaveFailure()) for (const listener of listeners) listener();
}
export function clearSaveFailure(key) { publish(key, false); }

export function saveCriticalJson(key, value, { storage } = {}) {
  try {
    storage ??= window.localStorage;
    const payload = JSON.stringify(value);
    if (payload === undefined) throw new TypeError('Cannot serialize save');
    const write = () => { storage.setItem(key, payload); publish(key, false); return true; };
    try { return write(); } catch (error) { if (!isQuotaExceededError(error)) throw error; }
    for (const cacheKey of DIAGNOSTIC_KEYS) {
      const raw = storage.getItem(cacheKey);
      if (!raw) continue;
      let lines = raw.split('\n').filter(Boolean);
      while (lines.length > 1) {
        lines = lines.slice(Math.ceil(lines.length / 2));
        storage.setItem(cacheKey, lines.join('\n'));
        try { return write(); } catch (error) { if (!isQuotaExceededError(error)) throw error; }
      }
    }
  } catch { /* Keep the previous snapshot intact and surface failure to the UI. */ }
  publish(key, true);
  return false;
}
