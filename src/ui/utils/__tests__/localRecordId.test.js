import { afterEach, expect, it, vi } from 'vitest';
import { localRecordId } from '../localRecordId.js';
import { PRACTICE_GAMES, PracticeSession } from '../../practice/practiceSession.js';
import { savePracticePreset, readPracticePresets } from '../../practice/practicePresetStore.js';
import { saveMeetup, readMeetups } from '../../meetups/meetupStore.js';
import { readSharedMix } from '../../sharing/mixShare.js';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });
it('uses native UUID when available', () => {
  vi.stubGlobal('crypto', { randomUUID: () => 'native-record-id' });
  expect(localRecordId()).toBe('native-record-id');
});
it('keeps local IDs distinct without randomUUID, even within the same millisecond', () => {
  vi.stubGlobal('crypto', {});
  vi.spyOn(Date, 'now').mockReturnValue(100);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  expect(new Set(Array.from({ length: 100 }, localRecordId)).size).toBe(100);
});
it.each(PRACTICE_GAMES)('starts $name practice on an HTTP device origin', game => {
  vi.stubGlobal('crypto', {});
  const session = new PracticeSession(game.id, game.defaults, { selfPlay: true });
  expect(session.handId).toMatch(/^practice-local-/);
  expect(session.snapshot.players[0].hand).toEqual(game.defaults);
  expect(session.legalActions().length).toBeGreaterThan(0);
});
it('saves practice presets and meetups and imports MIX without randomUUID', () => {
  vi.stubGlobal('crypto', {});
  const game = PRACTICE_GAMES[0];
  const preset = savePracticePreset('Local practice', { variant: game.id, cards: game.defaults });
  expect(readPracticePresets().entries[0].id).toBe(preset.id);
  saveMeetup({ name: 'Local meeting', organizer: 'QA', startsAt: '2026-10-01T19:00:00+09:00', repeat: 'once' });
  expect(readMeetups()).toHaveLength(1);
  const mix = readSharedMix(btoa(JSON.stringify({ version: 1, name: 'Local MIX', games: ['D03', 'D01'], hands: 4, mode: 'FIXED' })));
  expect(mix.selectedGameIds).toEqual(['D03', 'D01']);
  expect(mix.id).toMatch(/^shared-local-/);
});
