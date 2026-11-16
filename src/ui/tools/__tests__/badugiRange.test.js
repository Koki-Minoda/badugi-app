import { describe, expect, it } from 'vitest';
import { compareBadugiDrawChoices, compareBadugiFinalBet, parseBadugiRange } from '../badugiEquity.js';

const hero = ['AC', '2D', '3H', 'KH'];
const range = '9S 7C 5D 4H 3\n8S 6C 4D 2H 1\nAC 6C 4D 2H 5';
const input = { hands: [hero, []], remainingDraws: 1, rangeText: range };

describe('weighted opponent ranges', () => {
  it('reads shorthands and reports the malformed source line', () => {
    expect(parseBadugiRange('a♣ 2D Th 3S 0.5').candidates).toEqual([{ cards: ['AC', '2D', '10H', '3S'], weight: 0.5 }]);
    expect(parseBadugiRange('\nAc AC 2H 4S 3')).toEqual({ error: 'rangeLine', line: 2 });
    expect(parseBadugiRange('As 2H 3D 4C 0')).toEqual({ error: 'rangeLine', line: 1 });
  });

  it('removes conflicting rows, combines equivalent hands and renormalizes surviving weights', () => {
    const result = compareBadugiDrawChoices({ ...input, rangeText: range + '\n4H 5D 7C 9S 1' });
    expect(result.range.hands).toBe(2);
    expect(result.range.excluded).toBe(1);
    // Against the first hand K♥ wins on 5 of 44 cards; against the second it wins on 4 of 44.
    const compared = result.columns[0].results[8];
    expect(compared.method).toBe('exact');
    expect(compared.players[0].equity).toBeCloseTo((4 * 5 + 4) / (5 * 44), 12);
    expect(compared.players[0].wins).toBeCloseTo(compared.players[0].equity, 12);
    expect(compareBadugiDrawChoices({ ...input, rangeText: 'AC 6C 4D 2H' })).toEqual({ error: 'rangeBlocked' });
    expect(compareBadugiDrawChoices({ ...input, deadCards: ['Ac'] })).toEqual({ error: 'duplicate' });
  });

  it.each([2, 3])('rolls out all %i remaining rounds across candidate hands', remainingDraws => {
    const result = compareBadugiDrawChoices({ ...input, remainingDraws });
    const pat = result.columns[0].results[8];
    const draw = result.columns[1].results[8];
    expect(pat.method).toBe('simulation');
    expect(draw.outcomes).toBeGreaterThanOrEqual(10000);
    expect(draw.players[0].equity).toBeGreaterThan(pat.players[0].equity);
    expect(draw.players[0].equity + draw.players[1].equity).toBeCloseTo(1, 12);
  });
});

describe('final betting EV', () => {
  it('chooses a response to a bet across the entire observation, before knowing the opponent hand', () => {
    const { actions: [action] } = compareBadugiFinalBet({
      hands: [['AS', '2H', '3D', '8C'], []],
      remainingDraws: 0, rangeText: 'AC 2D 3H 7S 1\nAH 2D 3C 8S 3\nKS QC JD 9H 2',
      settings: { pot: 20, bet: 10, lead: 10, call: 13 },
    });
    expect(action.terminal.leadWeight).toBeCloseTo(2 / 3);
    expect(action.terminal.call / action.terminal.leadWeight).toBeCloseTo(5);
    expect(action.terminal.check / action.terminal.checkWeight).toBeCloseTo(20);
    expect(action.terminal.bet / action.terminal.checkWeight).toBeCloseTo(30);
    expect(action.ev).toBeCloseTo(40 / 3);
  });

  it('returns the existing pot when the opponent folds and zero when you fold', () => {
    const input = {
      hands: [['AS', '2H', '3D', '8C'], ['AC', '2D', '3H', '7S']],
      remainingDraws: 0,
    };
    expect(compareBadugiFinalBet({ ...input, settings: { pot: 20, bet: 10, lead: 0, call: 0 } }).actions[0].ev).toBe(20);
    expect(compareBadugiFinalBet({ ...input, settings: { pot: 20, bet: 10, lead: 10, call: 0 } }).actions[0].ev).toBe(0);
  });

  it('compares third-draw choices and settles to showdown equity without bets', () => {
    const settings = { pot: 20, bet: 10, lead: 0, call: 13 };
    // The opponent has a made hand and calls every time. In this losing
    // scenario the optimal response after a check is to check back.
    const result = compareBadugiFinalBet({ ...input, rangeText: 'AS 2H 3D 4C', opponentCount: 0, settings });
    expect(result.actions).toHaveLength(5);
    expect(result.actions[0].ev).toBe(0);
    expect(result.actions.every(action => action.ev >= 0)).toBe(true);
    expect(compareBadugiFinalBet({ ...input, opponentCount: 2, settings })).toEqual({ error: 'betDrawCount' });
  });
});
