import { reviewVariant } from '../review/reviewStore.js';
import { PRACTICE_GAMES, validatePracticeSetup } from './practiceSetup.js';

export function practiceFromReview(hand) {
  const variant = reviewVariant(hand);
  if (!PRACTICE_GAMES.some(game => game.id === variant)) return { error: 'unsupported' };
  const seats = hand.seats ?? hand.playerSummaries ?? hand.players ?? [];
  const hero = seats.find(seat => seat?.isHero === true) ?? seats.find(seat => seat && seat.isHero !== false && (seat.seat ?? seat.seatIndex) === (hand.heroSeat ?? 0));
  const cards = hero?.initialHand;
  // Never substitute final cards or another player's hand for missing starting cards.
  if (!validatePracticeSetup(variant, cards)) return { error: 'missing' };
  return { variant, cards: [...cards] };
}
export function practiceUrl(setup) {
  return `/learn/practice?${new URLSearchParams({ variant: setup.variant, cards: setup.cards.join(',') })}`;
}
export function parsePracticeUrl(search) {
  const params = new URLSearchParams(search);
  if (!params.has('variant') && !params.has('cards')) return null;
  const variant = params.get('variant');
  const cards = (params.get('cards') ?? '').split(',');
  if (!validatePracticeSetup(variant, cards)) return { error: 'invalid' };
  return { variant, cards };
}
