import { describe, it, expect } from 'vitest';
import { compareHands, recommendGames } from '../handTools.js';
import { newClock, advanceClock, toggleClock, validateClock } from '../tableClock.js';
import { evaluateLowHand } from '../../../games/evaluators/low.js';
import { ArchieTripleDrawEngine } from '../../../games/draw/SpecialDrawEngine.js';

describe('hand tools use game rules', () => {
  it('rejects duplicates across the two hands', () => {
    expect(() => compareHands('badugi', [['AS','2H','3D','4C'],['AS','5H','6D','7C']])).toThrow();
  });
  it('explains quartered pots and low non-qualification', () => {
    const result = compareHands('hiLo8', [['AS','2S','3S','4S','5S'],['AH','2D','3H','4C','5D']]);
    expect(result.shares).toEqual([.75,.25]);
    expect(result.parts[1].winners).toEqual([0,1]);
    const noLow = compareHands('hiLo8', [['KS','KH','KD','KC','9S'],['QS','QH','QD','QC','10S']]);
    expect(noLow.shares).toEqual([1,0]);
    expect(noLow.parts[1].winners).toEqual([]);
  });
  it('does not qualify paired eight-low cards', () => {
    expect(evaluateLowHand({ cards:['AS','AH','2D','3C','4S'], lowType:'A5', requireQualifier:8 }).qualifies).toBe(false);
    expect(evaluateLowHand({ cards:['AS','2H','3D','4C','8S'], lowType:'A5', requireQualifier:8 }).qualifies).toBe(true);
  });
  it('Archie requires at least nines for the high side', () => {
    const engine = new ArchieTripleDrawEngine();
    expect(engine.evaluateComponent(['8S','8H','KD','QC','10S'],'archieHigh').qualifies).toBe(false);
    expect(engine.evaluateComponent(['9S','9H','KD','QC','10S'],'archieHigh').qualifies).toBe(true);
    expect(engine.evaluateComponent(['2S','2H','3D','3C','10S'],'archieHigh').qualifies).toBe(true);
  });
  it('returns valid practice cards and reasons, without odds', () => {
    const result = recommendGames(['AS','2H','3D','4C','5S']);
    expect(result.suggestions.map(s => s.id)).toContain('ace_to_five_triple_draw');
    expect(result.suggestions.find(s => s.id === 'badugi').cards).toHaveLength(4);
  });
});
describe('live table clock', () => {
  it('catches up across hidden-tab levels and a break using the deadline', () => {
    const start = toggleClock(newClock('short'), 1000);
    const after = advanceClock(start, 1000 + 26*60000);
    expect(after).toMatchObject({ index:4, phase:'level', remainingMs:4*60000 });
  });
  it('pause/resume preserves time and persisted clocks retain deadlines', () => {
    const start = toggleClock(newClock('short'), 0);
    const pause = toggleClock(start, 60000);
    expect(pause.remainingMs).toBe(240000);
    expect(advanceClock(pause, 9999999)).toEqual(pause);
    const resume = toggleClock(JSON.parse(JSON.stringify(pause)), 900000);
    expect(resume.deadline).toBe(1140000);
  });
  it('finishes exactly once and rejects corrupt saved data', () => {
    const start = toggleClock(newClock(), 1);
    expect(advanceClock(start, 999999999).ended).toBe(true);
    expect(() => validateClock({ ...newClock(), remainingMs: NaN })).toThrow();
  });
});
it('Badeucey uses ace-high Badugi while Badacey keeps ace low',()=>{
 const hands=[['AS','2H','3D','4C','KS'],['5S','2D','3C','4H','QS']];
 expect(compareHands('badeucey',hands).parts[0].winners).toEqual([1]);
 expect(compareHands('badacey',hands).parts[0].winners).toEqual([0]);
});
it('Archie awards the whole pot to best high when neither side qualifies',()=>{
 const result=compareHands('archie',[['8S','8H','KD','QC','10S'],['7S','7H','AD','JC','9S']]);
 expect(result.fallbackHigh).toBe(true);expect(result.shares).toEqual([1,0]);
});
