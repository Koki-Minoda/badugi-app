import { describe, expect, it } from 'vitest';
import { replayHandFromHistory } from '../../../games/badugi/flow/handReplay.js';
import { badugiReplaySpot, readBadugiReviews, saveBadugiReview } from '../badugiReplayReview.js';

const early = { type: 'DRAW_ACTION', seat: 2, drawRoundIndex: 1, drawCount: 1, before: ['AC', '2D', '3H', 'QH'], discarded: [3], potAfter: 30 };
const villain = { type: 'DRAW_ACTION', seat: 0, drawRoundIndex: 3, drawCount: 1, before: ['9S', '7C', '5D', '4H'], after: ['8S', '7C', '5D', '4H'] };
const hero = { type: 'DRAW_ACTION', seat: 2, drawRoundIndex: 3, actionSeq: 12, drawCount: 1, before: ['AC', '2D', '3H', 'KH'], discarded: [3], after: ['AC', '2D', '3H', '4S'] };
const history = { variantId: 'badugi', handId: 'test', seats: [{ seat: 0, startStack: 100 }, { seat: 2, isHero: true, startStack: 90 }] };

describe('Badugi replay review', () => {
  it('imports only the hero’s pre-draw hand, prior discards and already observed count', () => {
    const hand = { ...history, events: [early, villain, hero] };
    const spot = badugiReplaySpot(hand, replayHandFromHistory(hand), 2);
    expect(spot).toEqual({
      handId: 'test', actionSeq: 12, remainingDraws: 1, cards: hero.before, actualDiscards: ['KH'],
      observedCount: 1, deadCards: ['QH'], pot: 30, effectiveStack: 90,
      drawHistory: [{ round: 1, player: 'hero', count: 1 }, { round: 3, player: 'opponent', count: 1 }],
    });
    const opponentHidden = { ...hand, events: [early, { ...villain, before: null, after: null }, hero] };
    expect(badugiReplaySpot(opponentHidden, replayHandFromHistory(opponentHidden), 2)).toEqual(spot);
  });

  it('does not use draws after the decision or estimate a missing before hand', () => {
    const ordered = { ...history, events: [early, hero, villain] };
    expect(badugiReplaySpot(ordered, replayHandFromHistory(ordered), 1).observedCount).toBeNull();
    const sparse = { ...history, events: [early, { ...hero, before: null }, villain] };
    expect(badugiReplaySpot(sparse, replayHandFromHistory(sparse), 1)).toBeNull();
  });

  it('keeps one score per action per user and compares net chip EV', () => {
    const hand = { ...history, events: [early, villain, hero] };
    const spot = badugiReplaySpot(hand, replayHandFromHistory(hand), 2);
    const user = 'test-review-user';
    const settings = { pot: 30, bet: 10, lead: 10, call: 12 };
    expect(saveBadugiReview(user, spot, settings, [{ cards: ['KH'], ev: 4 }, { cards: [], ev: 6 }], { opponentCount: 1 })).toBe(true);
    expect(readBadugiReviews(user)[0]).toMatchObject({ loss: 2, cards: ['KH'], best: [] });
    expect(saveBadugiReview(user, spot, settings, [{ cards: ['KH'], ev: 7 }, { cards: [], ev: 6 }], { opponentCount: 1 })).toBe(true);
    expect(readBadugiReviews(user)).toHaveLength(1);
    expect(readBadugiReviews(user)[0].loss).toBe(0);
    expect(readBadugiReviews('other-user')).toEqual([]);
  });
});
