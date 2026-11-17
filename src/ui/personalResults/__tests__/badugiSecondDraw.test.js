import { describe, expect, it } from 'vitest';
import { compareBadugiFinalBet } from '../../tools/badugiEquity.js';
import {
  assessSecondDrawPair,
  measureSecondDrawTransfer,
  secondDrawPairRequest,
  secondDrawPairs,
  summarizeSecondDrawPractice,
} from '../badugiSecondDraw.js';

describe('paired second-draw decisions', () => {
  it('changes only one condition, with both flips and a stable answer on new hands', () => {
    const practice = secondDrawPairs('practice');
    const retest = secondDrawPairs('retest');
    const hands = [...practice, ...retest].map(pair => pair.hero.slice().sort().join(','));
    expect(new Set(hands).size).toBe(6);
    for (const pairs of [practice, retest]) {
      const flips = [];
      const allPat = [];
      for (const pair of pairs) {
        const [a, b] = pair.spots;
        expect(Number(a.opponentCount !== b.opponentCount) + Number(a.rangeText !== b.rangeText)).toBe(1);
        const result = secondDrawPairRequest(pair).pair.map(compareBadugiFinalBet);
        const ranked = result.map(({ actions }) => [...actions].sort((left, right) => right.ev - left.ev));
        ranked.forEach(([best, second]) => expect(best.ev - second.ev).toBeGreaterThan(1.96 * (best.evSE + second.evSE)));
        const [first, second] = ranked.map(([best]) => best.cards[0] ?? 'pat');
        flips.push(first !== second);
        allPat.push(assessSecondDrawPair(result, [{ move: 'pat' }, { move: 'pat' }]));
      }
      expect(flips.filter(Boolean)).toHaveLength(2);
      expect(summarizeSecondDrawPractice(allPat)).toMatchObject({ closePairs: 1, pairs: 3 });
    }
  });

  it('tracks only eligible observed decisions before training and new decisions after it', () => {
    const draw = { type: 'DRAW_ACTION', seat: 0, drawRoundIndex: 2, drawCount: 1, actionSeq: 3,
      before: ['AS','3H','5D','10C'], discarded: [3], after: ['AS','3H','5D','4C'] };
    const opponent = { type: 'DRAW_ACTION', seat: 1, drawRoundIndex: 2, drawCount: 1, actionSeq: 2 };
    const hand = (handId, endedAt, observed = true) => ({
      handId, endedAt, variantId: 'badugi', userId: 5,
      seats: [{ seat: 0, isHero: true, startStack: 100 }, { seat: 1, startStack: 100 }],
      events: [{ type: 'HAND_START' }, ...(observed ? [opponent, draw] : [draw, opponent])],
    });
    const first = hand('before', 10);
    const reviews = [
      { handId: 'before', actionSeq: 3, remainingDraws: 2, loss: 4, bet: 10, samplingMargin: 2 },
      { handId: 'after', actionSeq: 3, remainingDraws: 2, loss: 0.7, bet: 10, samplingMargin: 1 },
    ];
    const result = measureSecondDrawTransfer(
      [first, first, hand('during', 25), hand('after', 50), hand('futureCount', 60, false),
        { ...hand('otherPlayer', 70), userId: 6 }, hand('next', 80)],
      reviews, { startedAt: 20, finishedAt: 30 }, 5,
    );
    expect(result.before).toEqual({ opportunities: 1, reviewed: 1, gaps: 1 });
    expect(result.after).toEqual({ opportunities: 2, reviewed: 1, gaps: 0 });
    expect(result.next).toMatchObject({ handId: 'next', actionSeq: 3 });
  });
});
