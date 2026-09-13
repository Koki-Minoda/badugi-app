import { useSyncExternalStore } from 'react';
import { PROGRESS_STORAGE_KEY, PROGRESS_CHANGE_EVENT, readLearningProgress } from './progressStore.js';
let cachedRaw;
let cachedState;
const unavailable = Symbol('unavailable');
function snapshot() {
  let raw;
  try { raw = localStorage.getItem(PROGRESS_STORAGE_KEY); } catch { raw = unavailable; }
  if (!cachedState || cachedRaw !== raw) { cachedRaw = raw; cachedState = readLearningProgress(); }
  return cachedState;
}
function subscribe(onChange) {
  const refresh = event => { if (event.type !== 'storage' || event.key === null || event.key === PROGRESS_STORAGE_KEY) onChange(); };
  window.addEventListener(PROGRESS_CHANGE_EVENT, refresh);
  window.addEventListener('storage', refresh);
  return () => { window.removeEventListener(PROGRESS_CHANGE_EVENT, refresh); window.removeEventListener('storage', refresh); };
}
export function useLearningProgress() { return useSyncExternalStore(subscribe, snapshot, snapshot); }
