import { describe, expect, it } from 'vitest';
import { PRACTICE_CARDS } from '../../practice/practiceSetup.js';
import { calculateBadugiEquity, compareBadugiDrawChoices } from '../badugiEquity.js';

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
    expect(calculateBadugiEquity({ ...example, remainingDraws: 4 })).toEqual({ error: 'drawRounds' });
    expect(calculateBadugiEquity({ ...example, discards: [['KH', 'kh'], []] })).toEqual({ error: 'discard' });
  });

  it.each([[2, 195 / 946], [3, 145 / 516]])('estimates showdown equity with %i draws remaining', (remainingDraws, exactEquity) => {
    const input = { ...example, remainingDraws };
    const result = calculateBadugiEquity(input);
    expect(result.method).toBe('simulation');
    expect(result.outcomes).toBe(10_000);
    // Exact recursive enumeration under the same later-draw policy.
    expect(Math.abs(result.players[0].equity - exactEquity)).toBeLessThan(0.01);
    expect(result.players[0].equity + result.players[1].equity).toBe(1);
    expect(calculateBadugiEquity(input)).toEqual(result);
  });

  it('compares all discards and opponent counts, including explicit card choices', () => {
    const available = ['4S', '6S', 'JS', 'AS', 'QC', 'KC', '8D', 'JD', '6H'];
    const deadCards = PRACTICE_CARDS.filter(card => !example.hands.flat().includes(card) && !available.includes(card));
    const { columns } = compareBadugiDrawChoices({ ...example, remainingDraws: 3, deadCards, opponentDiscards: ['4H'] });
    expect(columns.map(column => column.cards.length)).toEqual([0, 1, 2, 3, 4, 1]);
    expect(columns.map(column => column.results.length)).toEqual(Array(6).fill(16));
    expect(columns[1].cards).toEqual(['9S']);
    expect(columns[5].cards).toEqual(['4H']);
    expect(Math.abs(columns[1].results[8].players[0].equity - 157 / 252)).toBeLessThan(0.01);
    expect(Math.abs(columns[1].results[1].players[0].equity - 587 / 2520)).toBeLessThan(0.01);
    expect(columns[1].results[15]).toEqual({ error: 'deckTooSmall' });
    expect(columns[5].results[8]).not.toEqual(columns[1].results[8]);
  });

  it('draws four new cards from a shared stock when explicitly requested', () => {
    const available = ['4S', '6S', 'JS', 'AS', 'QC', 'KC', '8D', 'JD', '6H'];
    const deadCards = PRACTICE_CARDS.filter(card => !example.hands.flat().includes(card) && !available.includes(card));
    const result = calculateBadugiEquity({ ...example, remainingDraws: 2, deadCards, discards: [example.hands[0], ['9S']] });
    expect(Math.abs(result.players[0].equity - 23 / 252)).toBeLessThan(0.01);
  });
});
