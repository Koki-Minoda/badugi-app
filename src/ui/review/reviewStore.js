import { normalizeAppVariantId } from '../game/appVariantRouting.js';

export const REVIEW_STORAGE_KEY = 'mgx.handReviews.v1';
export const REVIEW_CHANGE_EVENT = 'mgx-hand-reviews-changed';
export const MAX_REVIEWS = 200;
export const MAX_NOTE_LENGTH = 2000;
export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 24;

export function reviewVariant(hand) {
  const id = hand?.variantId ?? hand?.gameVariant ?? hand?.gameId ?? hand?.metadata?.variantId;
  return normalizeAppVariantId(id, null) ?? id ?? 'unknown';
}

export function reviewKey(hand) {
  if (!hand?.handId) return null;
  // Controller hand numbers may be reused by another session or variant.
  return JSON.stringify([hand.tournamentId ?? '', hand.handId, hand.startedAt ?? hand.ts ?? hand.endedAt ?? 0, reviewVariant(hand)]);
}

export function parseReviewTags(text) {
  const tags = [...new Set(String(text).split(/[,、\n]+/).map(tag => tag.trim()).filter(Boolean))];
  if (tags.length > MAX_TAGS || tags.some(tag => tag.length > MAX_TAG_LENGTH)) throw new Error('tags');
  return tags;
}

function validHand(hand) {
  if (!hand || typeof hand !== 'object' || Array.isArray(hand) || !reviewKey(hand)) return false;
  return ['events', 'actionLog', 'seats', 'players', 'playerSummaries', 'winners', 'boardCards'].every(field => hand[field] == null || Array.isArray(hand[field]));
}

export function readReviews() {
  try {
    const raw = localStorage.getItem(REVIEW_STORAGE_KEY);
    if (!raw) return { entries: [], error: null };
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.entries) || data.entries.some(entry =>
      !entry || !validHand(entry.hand) || entry.key !== reviewKey(entry.hand) || typeof entry.note !== 'string' ||
      !Array.isArray(entry.tags) || entry.tags.some(tag => typeof tag !== 'string'))) throw new Error('unreadable');
    return { entries: data.entries, error: null };
  } catch {
    return { entries: [], error: 'unreadable' };
  }
}

function writeReviews(entries) {
  try {
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify({ version: 1, entries }));
  } catch {
    throw new Error('storage');
  }
  window.dispatchEvent(new Event(REVIEW_CHANGE_EVENT));
}

export function saveReview(hand, annotation = {}) {
  const key = reviewKey(hand);
  if (!key || !validHand(hand)) throw new Error('missing');
  const state = readReviews();
  if (state.error) throw new Error(state.error);
  const existing = state.entries.find(entry => entry.key === key);
  if (!existing && state.entries.length >= MAX_REVIEWS) throw new Error('limit');
  const note = annotation.note ?? existing?.note ?? '';
  if (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH) throw new Error('note');
  const tags = annotation.tags === undefined ? existing?.tags ?? [] : parseReviewTags(annotation.tags.join(','));
  // Keep a separate snapshot, so history retention cannot remove a saved hand.
  const entry = { key, hand: existing?.hand ?? JSON.parse(JSON.stringify(hand)), note, tags,
    savedAt: existing?.savedAt ?? Date.now(), updatedAt: Date.now() };
  writeReviews([entry, ...state.entries.filter(item => item.key !== key)]);
  return entry;
}

export function removeReview(key) {
  const state = readReviews();
  if (state.error) throw new Error(state.error);
  writeReviews(state.entries.filter(entry => entry.key !== key));
}
