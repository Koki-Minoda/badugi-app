import { describe, expect, it } from 'vitest';
import { BadugiControllerInteractiveV2Draft } from '../badugiControllerInteractiveV2Draft.js';
import { BadugiControllerBeliefInteractiveV3Draft } from '../badugiControllerBeliefInteractiveV3Draft.js';
import {
  classifyBadugiPredrawHeroHand,
  previewBadugiPredrawHeroHand,
  screenBadugiPredrawSeedRange,
} from '../training/screen_badugi_predraw_range_seeds.mjs';

describe('development-only predraw seed screen', () => {
  it.each([
    [2, 2, false], [3, 3, false], [6, 2, false], [6, 3, false], [6, 6, false],
    [2, 2, true], [3, 3, true], [6, 2, true], [6, 3, true], [6, 6, true],
  ])('matches the real first-hand deal at %i/%i seats, MTT=%s',
    (seatCount, occupiedSeatCount, isTournament) => {
      for (const seed of [201, 78727, 2147483647, 4294967295]) {
        const session = new BadugiControllerInteractiveV2Draft({
          seatCount, occupiedSeatCount, isTournament, seed,
        });
        session.nextHand();
        const snapshot = session.controller.getUiSnapshot(session.state);
        for (let heroSeat = 0; heroSeat < occupiedSeatCount; heroSeat += 1) {
          const cards = previewBadugiPredrawHeroHand({
            seed, seatCount, occupiedSeatCount, heroSeat,
          });
          expect(cards).toEqual(snapshot.players[heroSeat].hand);
          expect(classifyBadugiPredrawHeroHand(cards).madeCards).toBeGreaterThanOrEqual(1);
        }
      }
    });

  it('matches the actor-visible belief bridge deal used for range evaluation', () => {
    const seed = 3100048123;
    const session = new BadugiControllerBeliefInteractiveV3Draft({
      seatCount: 6, occupiedSeatCount: 6, isTournament: false, seed,
    });
    session.nextHand();
    const snapshot = session.controller.getUiSnapshot(session.state);
    for (let heroSeat = 0; heroSeat < 6; heroSeat += 1) {
      expect(previewBadugiPredrawHeroHand({
        seed, seatCount: 6, occupiedSeatCount: 6, heroSeat,
      })).toEqual(snapshot.players[heroSeat].hand);
    }
  });

  it('classifies the best effective Badugi hand, including true four-card lows', () => {
    expect(classifyBadugiPredrawHeroHand(['AS', '2H', '3D', '4C']))
      .toEqual({ madeCards: 4, highRank: 3, highBand: 'A-5' });
    expect(classifyBadugiPredrawHeroHand(['AS', '4S', '9D', 'KH']))
      .toEqual({ madeCards: 3, highRank: 12, highBand: 'T-K' });
  });

  it('finds rare four-card lows without choosing on opponents or outcomes', () => {
    const result = screenBadugiPredrawSeedRange({
      firstSeed: 3100000000, scanCount: 100000,
      seatCount: 6, occupiedSeatCount: 6, heroSeat: 2,
      madeCards: 4, highBand: 'A-5', maxMatches: 5,
    });
    expect(result.scanned).toBeGreaterThan(5);
    expect(result.selected).toHaveLength(5);
    expect(new Set(result.selected.map(({ seed }) => seed)).size).toBe(5);
    for (const row of result.selected) {
      expect(row.hand).toMatchObject({ madeCards: 4, highBand: 'A-5' });
      const session = new BadugiControllerInteractiveV2Draft({
        seatCount: 6, occupiedSeatCount: 6, isTournament: false, seed: row.seed,
      });
      session.nextHand();
      expect(session.controller.getUiSnapshot(session.state).players[2].hand)
        .toEqual(row.cards);
    }
  });

  it('can select one exact highest card within a hand band', () => {
    const result = screenBadugiPredrawSeedRange({
      firstSeed: 3100000000, scanCount: 100000,
      seatCount: 6, occupiedSeatCount: 6, heroSeat: 2,
      madeCards: 4, highBand: 'A-5', highRank: 4, maxMatches: 3,
    });
    expect(result.selected).toHaveLength(3);
    expect(result.selected.every(({ hand }) => hand.madeCards === 4 &&
      hand.highRank === 4 && hand.highBand === 'A-5')).toBe(true);
    expect(() => screenBadugiPredrawSeedRange({
      firstSeed: 3100000000, scanCount: 1,
      seatCount: 6, occupiedSeatCount: 6, heroSeat: 2,
      madeCards: 4, highBand: 'A-5', highRank: 5, maxMatches: 1,
    })).toThrow('bounded unsigned seeds');
  });

  it('rejects invalid seat and hand input', () => {
    expect(() => previewBadugiPredrawHeroHand({
      seed: 1, seatCount: 6, occupiedSeatCount: 2, heroSeat: 4,
    })).toThrow('valid seed');
    expect(() => classifyBadugiPredrawHeroHand(['AS', '2H']))
      .toThrow('four hero cards');
  });
});
