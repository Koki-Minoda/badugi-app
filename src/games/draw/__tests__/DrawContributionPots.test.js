import { describe, expect, it } from 'vitest';
import { DeuceToSevenTripleDrawEngine } from '../DeuceToSevenTripleDrawEngine.js';
import { AceToFiveTripleDrawEngine } from '../AceToFiveTripleDrawEngine.js';
import { BadeuceyTripleDrawEngine, BadaceyTripleDrawEngine, BadeuceySingleDrawEngine, BadaceySingleDrawEngine } from '../SpecialDrawEngine.js';

const hands = [
  ['7S', '5D', '4C', '3H', '2S'],
  ['8S', '6D', '5C', '4H', '3S'],
  ['KS', 'KD', 'QC', 'QH', '9S'],
];
describe.each([DeuceToSevenTripleDrawEngine, AceToFiveTripleDrawEngine,
  BadeuceyTripleDrawEngine, BadaceyTripleDrawEngine, BadeuceySingleDrawEngine, BadaceySingleDrawEngine])('%s contribution settlement', Engine => {
  function settle(investments, { folded = [], pendingBets = false } = {}) {
    const engine = new Engine();
    const state = engine.initHand({ seatConfig: ['HUMAN', 'CPU', 'CPU'], startingStack: 0, dealerIndex: 0 });
    state.players = state.players.map((player, i) => ({
      ...player, hand: hands[i], stack: 0, bet: pendingBets ? investments[i] : 0,
      totalInvested: investments[i], folded: folded.includes(i), sittingOut: false, allIn: true,
    }));
    state.pots = pendingBets ? [] : [{ amount: investments.reduce((a,b) => a+b,0), eligiblePlayerIds: state.players.map(p => p.playerId) }];
    return engine.resolveShowdown(state);
  }
  it('limits the short-stack scoop to the main pot', () => {
    const result = settle([50, 100, 100]);
    expect(result.state.players.map(p => p.stack)).toEqual([150, 100, 0]);
    expect(result.totalPot).toBe(250);
  });
  it('settles outstanding street bets without giving the short stack side-pot eligibility', () => {
    expect(settle([50, 100, 100], {pendingBets:true}).state.players.map(p => p.stack)).toEqual([150, 100, 0]);
  });
  it('preserves several contribution levels including an uncalled excess', () => {
    expect(settle([50, 100, 150]).state.players.map(p => p.stack)).toEqual([150, 100, 50]);
  });
  it('keeps a folded contribution but excludes its hand from winning', () => {
    expect(settle([50, 100, 100], {folded:[0]}).state.players.map(p => p.stack)).toEqual([0, 250, 0]);
  });
  it('conserves odd chips across the main and side pots', () => {
    expect(settle([51, 100, 100]).state.players.map(p => p.stack)).toEqual([153, 98, 0]);
  });
});
