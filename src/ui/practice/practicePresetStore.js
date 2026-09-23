import { localRecordId } from '../utils/localRecordId.js';
import { validatePracticeSetup } from './practiceSetup.js';

export const PRESET_STORAGE_KEY = 'mgx.practicePresets.v1';
export const PRESET_CHANGE_EVENT = 'mgx-practice-presets-changed';
export const MAX_PRESETS = 50;
export const MAX_PRESET_NAME = 60;
export function readPracticePresets() {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return { entries: [], error: null };
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.entries) || data.entries.length > MAX_PRESETS || data.entries.some(entry =>
      !entry || typeof entry.id !== 'string' || !entry.id || typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > MAX_PRESET_NAME || !validatePracticeSetup(entry.variant, entry.cards)) ||
      new Set(data.entries.map(entry => entry.id)).size !== data.entries.length || new Set(data.entries.map(entry => entry.name.trim())).size !== data.entries.length) throw new Error('unreadable');
    return { entries: data.entries, error: null };
  } catch { return { entries: [], error: 'unreadable' }; }
}
function write(entries) {
  try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify({ version: 1, entries })); }
  catch { throw new Error('storage'); }
  window.dispatchEvent(new Event(PRESET_CHANGE_EVENT));
}
export function savePracticePreset(name, setup) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_PRESET_NAME) throw new Error('name');
  if (!validatePracticeSetup(setup.variant, setup.cards)) throw new Error('setup');
  const state = readPracticePresets();
  if (state.error) throw new Error(state.error);
  if (state.entries.some(entry => entry.name.trim() === name.trim())) throw new Error('duplicate');
  if (state.entries.length >= MAX_PRESETS) throw new Error('limit');
  const entry = { id: localRecordId(), name: name.trim(), variant: setup.variant, cards: [...setup.cards], savedAt: Date.now() };
  write([entry, ...state.entries]);
  return entry;
}
export function removePracticePreset(id) {
  const state = readPracticePresets();
  if (state.error) throw new Error(state.error);
  write(state.entries.filter(entry => entry.id !== id));
}
