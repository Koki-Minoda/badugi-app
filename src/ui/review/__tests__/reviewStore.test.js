import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { readReviews, saveReview, removeReview, reviewKey, parseReviewTags, REVIEW_STORAGE_KEY, MAX_REVIEWS } from '../reviewStore.js';
const hand = { handId: 'hand-1', startedAt: 10, variantId: 'D02', events: [{ type: 'HAND_END', totalPot: 40 }] };
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('saved hand retention', () => {
  it('keeps an independent hand snapshot and preserves notes on duplicate saves', () => {
    const original = structuredClone(hand);
    const first = saveReview(original, { note: 'Review the call', tags: ['River', 'River', ' Draw '] });
    original.events[0].totalPot = 99;
    saveReview(original);
    const [saved] = readReviews().entries;
    expect(readReviews().entries).toHaveLength(1);
    expect(saved.hand.events[0].totalPot).toBe(40);
    expect(saved.note).toBe('Review the call');
    expect(saved.tags).toEqual(['River', 'Draw']);
    expect(saved.savedAt).toBe(first.savedAt);
  });
  it('distinguishes reused controller IDs by session time, variant and tournament', () => {
    [hand, { ...hand, startedAt: 11 }, { ...hand, variantId: 'badugi' }, { ...hand, tournamentId: 'event-1' }].forEach(h => saveReview(h));
    expect(readReviews().entries).toHaveLength(4);
    expect(reviewKey(hand)).toBe(reviewKey({ ...hand, variantId: 'ace_to_five_triple_draw', historySource: 'cash' }));
  });
  it('removes only the selected saved hand and leaves ordinary history intact', () => {
    localStorage.setItem('badugi.history.hands', JSON.stringify([hand]));
    saveReview(hand);
    removeReview(reviewKey(hand));
    expect(readReviews().entries).toEqual([]);
    expect(JSON.parse(localStorage.getItem('badugi.history.hands'))).toEqual([hand]);
  });
  it('does not depend on normal history still existing', () => {
    saveReview(hand);
    localStorage.removeItem('badugi.history.hands');
    expect(readReviews().entries[0].hand).toEqual(hand);
  });
  it('keeps stored data unchanged when storage capacity is exhausted', () => {
    saveReview(hand);
    const before = localStorage.getItem(REVIEW_STORAGE_KEY);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(() => saveReview(hand, { note: 'new' })).toThrow('storage');
    expect(localStorage.getItem(REVIEW_STORAGE_KEY)).toBe(before);
  });
  it.each(['{broken', JSON.stringify({ version: 2, entries: [] }), JSON.stringify({ version: 1, entries: [{}] })])('refuses to overwrite unreadable data: %s', raw => {
    localStorage.setItem(REVIEW_STORAGE_KEY, raw);
    expect(readReviews().error).toBe('unreadable');
    expect(() => saveReview(hand)).toThrow('unreadable');
    expect(() => removeReview(reviewKey(hand))).toThrow('unreadable');
    expect(localStorage.getItem(REVIEW_STORAGE_KEY)).toBe(raw);
  });
  it('enforces the limit without evicting saved hands, while allowing edits', () => {
    const entries = Array.from({ length: MAX_REVIEWS }, (_, i) => {
      const h = { ...hand, handId: String(i) };
      return { key: reviewKey(h), hand: h, note: '', tags: [], savedAt: i };
    });
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify({ version: 1, entries }));
    expect(() => saveReview(hand)).toThrow('limit');
    saveReview(entries[0].hand, { note: 'keep' });
    expect(readReviews().entries).toHaveLength(MAX_REVIEWS);
    expect(readReviews().entries[0].note).toBe('keep');
  });
  it('validates annotation limits and accepts Japanese separators', () => {
    expect(parseReviewTags(' リバー、ドロー,リバー\n迷った局面 ')).toEqual(['リバー', 'ドロー', '迷った局面']);
    expect(() => parseReviewTags('x'.repeat(25))).toThrow('tags');
    expect(() => parseReviewTags('a,b,c,d,e,f,g,h,i')).toThrow('tags');
    expect(() => saveReview(hand, { note: 'x'.repeat(2001) })).toThrow('note');
    expect(() => saveReview(null)).toThrow('missing');
    expect(readReviews().entries).toEqual([]);
  });
});
