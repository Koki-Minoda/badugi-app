import { afterEach, expect, it, vi } from 'vitest';
import { PRACTICE_GAMES } from '../practiceSetup.js';
import { practiceFromReview, practiceUrl, parsePracticeUrl } from '../practiceTransfer.js';
import { MAX_PRESETS, PRESET_STORAGE_KEY, readPracticePresets, savePracticePreset, removePracticePreset } from '../practicePresetStore.js';
const setup = { variant: 'badugi', cards: ['AS', '2H', '3D', '4C'] };
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
it.each(PRACTICE_GAMES)('$name transfers only recorded starting cards and survives a URL reload', game => {
  const result = practiceFromReview({ variantId: game.id, seats: [{ seat: 0, initialHand: game.defaults, hand: ['KS'] }] });
  expect(result).toEqual({ variant: game.id, cards: game.defaults });
  expect(parsePracticeUrl(new URL(practiceUrl(result), 'http://localhost').search)).toEqual(result);
});
it('resolves aliases and the explicit hero before seat zero', () => {
  expect(practiceFromReview({ variantId: 'D02', seats: [{ seat: 0, initialHand: setup.cards }, { seat: 2, isHero: true, initialHand: ['AS', '2H', '3D', '4C', '5S'] }] }).cards).toHaveLength(5);
});
it('rejects unsupported, missing, duplicate and opponent cards without substituting final cards', () => {
  expect(practiceFromReview({ variantId: 'stud' }).error).toBe('unsupported');
  for (const seat of [{ hand: setup.cards }, { initialHand: ['AS'] }, { initialHand: ['AS', 'AS', '3D', '4C'] }, { isHero: false, initialHand: setup.cards }]) {
    expect(practiceFromReview({ variantId: 'badugi', seats: [{ seat: 0, ...seat }] }).error).toBe('missing');
  }
  expect(parsePracticeUrl('?variant=badugi&cards=AS,AS,3D,4C').error).toBe('invalid');
  expect(parsePracticeUrl('?variant=stud&cards=AS').error).toBe('invalid');
  expect(parsePracticeUrl('?unrelated=1')).toBeNull();
});
it('persists independent setups and removes only the selected setup, preserving other stores', () => {
  localStorage.setItem('badugi.history.hands', 'sentinel');
  localStorage.setItem('mgx.handReviews.v1', 'review-sentinel');
  const cards = [...setup.cards];
  const a = savePracticePreset('  First  ', { ...setup, cards });
  cards[0] = 'KS';
  const b = savePracticePreset('Second', setup);
  expect(readPracticePresets().entries.find(entry => entry.id === a.id)).toMatchObject({ name: 'First', cards: setup.cards });
  removePracticePreset(a.id);
  expect(readPracticePresets().entries.map(entry => entry.id)).toEqual([b.id]);
  expect(localStorage.getItem('badugi.history.hands')).toBe('sentinel');
  expect(localStorage.getItem('mgx.handReviews.v1')).toBe('review-sentinel');
});
it('rejects duplicate names, invalid setups, long names and the 51st entry without overwriting', () => {
  savePracticePreset('First', setup);
  const original = localStorage.getItem(PRESET_STORAGE_KEY);
  expect(() => savePracticePreset(' First ', setup)).toThrow('duplicate');
  expect(() => savePracticePreset('Invalid', { ...setup, cards: [] })).toThrow('setup');
  expect(() => savePracticePreset(' '.repeat(2), setup)).toThrow('name');
  expect(() => savePracticePreset('a'.repeat(61), setup)).toThrow('name');
  expect(localStorage.getItem(PRESET_STORAGE_KEY)).toBe(original);
  for (let index = 1; index < MAX_PRESETS; index++) savePracticePreset(`Setup ${index}`, setup);
  expect(() => savePracticePreset('Overflow', setup)).toThrow('limit');
  expect(readPracticePresets().entries).toHaveLength(50);
});
it.each(['{broken', JSON.stringify({ version: 2, entries: [] }), JSON.stringify({ version: 1, entries: [{ id: 'x', name: 'x', ...setup, cards: ['XX'] }] })])('preserves unreadable stored data %s', raw => {
  localStorage.setItem(PRESET_STORAGE_KEY, raw);
  expect(readPracticePresets().error).toBe('unreadable');
  expect(() => savePracticePreset('New', setup)).toThrow('unreadable');
  expect(() => removePracticePreset('x')).toThrow('unreadable');
  expect(localStorage.getItem(PRESET_STORAGE_KEY)).toBe(raw);
});
it('reports storage failure without altering the previous data', () => {
  savePracticePreset('Original', setup);
  const raw = localStorage.getItem(PRESET_STORAGE_KEY);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  expect(() => savePracticePreset('New', setup)).toThrow('storage');
  expect(() => removePracticePreset(readPracticePresets().entries[0].id)).toThrow('storage');
  expect(localStorage.getItem(PRESET_STORAGE_KEY)).toBe(raw);
});
