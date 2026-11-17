import { describe, expect, it } from 'vitest';
import { PRACTICE_CARDS } from '../../practice/practiceSetup.js';
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
  it('includes T-high but excludes J-high at the displayed rank limit 10', () => {
    const value = (highest, lead, call) => compareBadugiFinalBet({
      hands: [['AS', '2H', '3D', '4C'], ['5S', '6H', '7D', highest + 'C']],
      remainingDraws: 0, settings: { pot: 20, bet: 10, lead, call },
    }).actions[0];
    expect(value('10', 10, 0).terminal.leadWeight).toBe(1);
    expect(value('J', 10, 0).terminal.leadWeight).toBe(0);
    expect(value('10', 0, 10).ev).toBe(30);
    expect(value('J', 0, 10).ev).toBe(20);
  });

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

describe('second-draw betting rollout', () => {
  const input = { hands: [['AS','2H','3D','8C'], ['AC','2D','3H','9S']], remainingDraws: 2, opponentCount: 0 };
  const settings = { pot: 20, bet: 10, lead: 10, call: 12, heroCall: 11, heroBet: 10, middleBet: 10 };
  const run = (overrides = {}, hands = input.hands) =>
    compareBadugiFinalBet({ ...input, hands, settings: { ...settings, ...overrides } }).actions[0];

  it('carries called bets through to the showdown and subtracts the hero contribution on each street', () => {
    expect(run()).toMatchObject({ equity: 1, ev: 40, evSE: 0, samples: 10_000 });
    expect(run({ middleBet: 0 })).toMatchObject({ equity: 1, ev: 30, evSE: 0 });
    expect(run({}, [['AS','2H','3D','JC'], input.hands[1]])).toMatchObject({ equity: 0, ev: -20 });
  });

  it('handles a fold immediately and pays the original pot when the opponent folds', () => {
    expect(run({ heroCall: 0 })).toMatchObject({ equity: 1, ev: 0 });
    expect(run({ lead: 0, call: 0 })).toMatchObject({ equity: 1, ev: 20 });
  });

  it('matches independent enumeration of two draws and two betting rounds within sampling error', () => {
    const hands = [['AS','3H','5D','10C'], ['2S','4H','6D','8C']];
    const stock = ['2C','5C','7C','9C','7S','QH','KS','4D'];
    const deadCards = PRACTICE_CARDS.filter(card => !hands.flat().includes(card) && !stock.includes(card));
    const result = compareBadugiFinalBet({ ...input, hands, deadCards, opponentCount: 1,
      settings: { ...settings, pot: 30, middleBet: 5 } });
    const discard = result.actions.find(action => action.cards[0] === '10C');
    expect(Math.abs(discard.ev - 755 / 42)).toBeLessThan(2 * discard.evSE);
    expect(Math.abs(discard.equity - 509 / 840)).toBeLessThan(0.01);
  });
});
