import { useSyncExternalStore } from 'react';
import { LANGUAGE_STORAGE_KEY, MGX_DEFAULT_LOCALE } from '../../config/mgxLocaleConfig.js';
const eventName = 'mgx:language';
let memoryLanguage;
let sessionOverride = false;
export function readLanguage() {
  if (sessionOverride) return memoryLanguage;
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? window.localStorage.getItem('mgx.language');
    return ['ja', 'en'].includes(value) ? value : memoryLanguage ?? MGX_DEFAULT_LOCALE;
  } catch { return memoryLanguage ?? MGX_DEFAULT_LOCALE; }
}
export function setLanguage(value) {
  if (!['ja', 'en'].includes(value)) return;
  memoryLanguage = value;
  try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value); sessionOverride = false; } catch { sessionOverride = true; }
  window.dispatchEvent(new Event(eventName));
}
function subscribe(notify) {
  const onStorage = event => { if (!event.key || event.key === LANGUAGE_STORAGE_KEY) notify(); };
  window.addEventListener(eventName, notify);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(eventName, notify); window.removeEventListener('storage', onStorage); };
}
export function useLanguage() { return useSyncExternalStore(subscribe, readLanguage, () => MGX_DEFAULT_LOCALE); }
export function useLanguageState() { return [useLanguage(), setLanguage]; }
