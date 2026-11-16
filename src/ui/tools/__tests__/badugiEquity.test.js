import { describe, expect, it } from 'vitest';
import { PRACTICE_CARDS } from '../../practice/practiceSetup.js';
import { calculateBadugiEquity } from '../badugiEquity.js';

const example = {
  hands: [['AC', '2D', '3H', 'KH'], ['9S', '7C', '5D', '4H']],
  remainingDraws: 1,
  discards: ['KH', null],
};

describe('Badugi showdown equity', () => {
  it('splits a tied showdown regardless of suits', () => {
    const result = calculateBadugiEquity({
      hands: [['AS', '2H', '3D', '4C'], ['AC', '2D', '3H', '4S']], remainingDraws: 0,
    });
    expect(result.outcomes).toBe(1);
    expect(result.players).toEqual(Array(2).fill({ wins: 0, ties: 1, losses: 0, equity: 0.5 }));
  });

  it('matches the published K♥ discard example and excludes known dead outs', () => {
    const result = calculateBadugiEquity(example);
    expect(result.outcomes).toBe(44);
    expect(result.players[0]).toEqual({ wins: 5, ties: 0, losses: 39, equity: 5 / 44 });
    const blocked = calculateBadugiEquity({ ...example, deadCards: ['4S'] });
    expect(blocked.outcomes).toBe(43);
    expect(blocked.players[0]).toEqual({ wins: 4, ties: 0, losses: 39, equity: 4 / 43 });
    expect(calculateBadugiEquity({ ...example, discards: [null, null] }).players[0].equity).toBe(0);
  });

  it('matches PokerStove counts for two simultaneous draws, including ties', () => {
    const result = calculateBadugiEquity({
      hands: [['AS', '2H', '3D', '4C'], ['AC', '2D', '3H', '4S']],
      remainingDraws: 1,
      discards: ['4C', '4S'],
    });
    expect(result.outcomes).toBe(44 * 43);
    expect(result.players).toEqual(Array(2).fill({ wins: 342, ties: 1208, losses: 342, equity: 0.5 }));
  });

  it('never redraws the original discards and checks the shared deck capacity', () => {
    const dead = PRACTICE_CARDS.filter(card => !example.hands.flat().includes(card) && card !== '4S');
    const lastCard = calculateBadugiEquity({ ...example, deadCards: dead });
    expect(lastCard.players[0]).toEqual({ wins: 1, ties: 0, losses: 0, equity: 1 });
    expect(calculateBadugiEquity({ ...example, deadCards: dead, discards: ['KH', '9S'] })).toEqual({ error: 'deckTooSmall' });
    expect(calculateBadugiEquity({ ...example, deadCards: [...dead, '4S'], discards: [null, null] }).outcomes).toBe(1);
  });

  it('rejects duplicate, malformed, missing and incompatible inputs', () => {
    expect(calculateBadugiEquity({ ...example, deadCards: [' ts ', '10S'] })).toEqual({ error: 'duplicate' });
    expect(calculateBadugiEquity({ ...example, deadCards: ['kH'] })).toEqual({ error: 'duplicate' });
    expect(calculateBadugiEquity({ ...example, deadCards: ['1S'] })).toEqual({ error: 'card' });
    expect(calculateBadugiEquity({ ...example, hands: [[], []] })).toEqual({ error: 'handSize' });
    expect(calculateBadugiEquity({ ...example, discards: ['9S', null] })).toEqual({ error: 'discard' });
    expect(calculateBadugiEquity({ ...example, remainingDraws: 0 })).toEqual({ error: 'discard' });
    expect(calculateBadugiEquity({ ...example, remainingDraws: 2 })).toEqual({ error: 'drawRounds' });
  });
});
