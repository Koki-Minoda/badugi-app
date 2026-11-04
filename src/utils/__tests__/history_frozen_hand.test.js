import { beforeEach, describe, expect, it } from 'vitest';
import { getHands, getTournamentHands, saveHandHistory,
  saveTournamentHandHistory } from '../history.js';

describe('persisting finalized immutable hand histories', () => {
  beforeEach(() => localStorage.clear());

  it('saves a frozen cash hand with its action events intact', () => {
    const record = Object.freeze({
      handId: 'cash-frozen-1',
      events: Object.freeze([{ type: 'BET_ACTION', seat: 1, action: 'call' }]),
    });
    saveHandHistory(record);
    expect(getHands()[0]).toMatchObject({
      handId: 'cash-frozen-1',
      events: [{ type: 'BET_ACTION', seat: 1, action: 'call' }],
    });
    expect(getHands()[0].ts).toEqual(expect.any(Number));
    expect(record).not.toHaveProperty('ts');
  });

  it('saves a frozen tournament hand without mutating the caller', () => {
    const record = Object.freeze({ handId: 'mtt-frozen-1', tournamentId: 'mtt-1', events: [] });
    saveTournamentHandHistory(record);
    expect(getTournamentHands()[0]).toMatchObject({
      handId: 'mtt-frozen-1', tournamentId: 'mtt-1', events: [],
    });
    expect(record).not.toHaveProperty('ts');
  });
});
