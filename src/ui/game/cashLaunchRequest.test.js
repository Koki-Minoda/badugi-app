import { describe, expect, it } from 'vitest';
import { getCashLaunchRequest } from './cashLaunchRequest.js';

describe('cash game links', () => {
  it.each([
    { mixedProfileId: 'qa-mix' },
    { learningVariant: 'badugi' },
    { multiGameConfig: { games: ['D03'] } },
    { multiGameResume: true },
  ])('preserves an explicit launch identity instead of treating its URL as plain cash: %o', state => {
    expect(getCashLaunchRequest({ pathname: '/game', search: '?variant=badugi', state })).toBeNull();
  });
  it.each(['beginner', 'standard', 'pro'])('preserves the selected %s opponent on a cold game visit', tier => {
    expect(getCashLaunchRequest({ pathname: '/game', search: `?variant=badugi&aiTier=${tier}` }))
      .toEqual({ variantId: 'badugi', cashTierId: tier });
  });
  it('resolves a catalog alias and defaults an invalid tier through the normal start handler', () => {
    expect(getCashLaunchRequest({ pathname: '/game', search: '?variant=D01&aiTier=unknown' }))
      .toEqual({ variantId: 'deuce_to_seven_triple_draw', cashTierId: null });
  });
  it.each([
    ['/menu', '?variant=badugi'],
    ['/game', ''],
    ['/game', '?variant=unknown'],
    ['/game', '?variant=badugi&mode=tournament-mtt'],
    ['/game', '?variant=badugi&mode=store_tournament'],
  ])('keeps %s%s on its existing navigation path', (pathname, search) => {
    expect(getCashLaunchRequest({ pathname, search })).toBeNull();
  });
});
