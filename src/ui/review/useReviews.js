import { useSyncExternalStore } from 'react';
import { readReviews, REVIEW_CHANGE_EVENT, REVIEW_STORAGE_KEY } from './reviewStore.js';

let cachedRaw;
let cachedState;
const unavailable = Symbol('storage-unavailable');
function snapshot() {
  let raw;
  try { raw = localStorage.getItem(REVIEW_STORAGE_KEY); } catch { raw = unavailable; }
  if (!cachedState || raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = readReviews();
  }
  return cachedState;
}
function subscribe(onChange) {
  const refresh = event => {
    if (event.type !== 'storage' || event.key === REVIEW_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener(REVIEW_CHANGE_EVENT, refresh);
  window.addEventListener('storage', refresh);
  return () => {
    window.removeEventListener(REVIEW_CHANGE_EVENT, refresh);
    window.removeEventListener('storage', refresh);
  };
}
export function useReviews() { return useSyncExternalStore(subscribe, snapshot, snapshot); }
