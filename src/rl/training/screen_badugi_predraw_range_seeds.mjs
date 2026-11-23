// Development-only seed screening. This reproduces the bridge's first-hand
// shuffle, then inspects only the prospective hero's own four cards. A seed
// selected here still runs through the unmodified real controller for EV.
import { DeckManager } from '../../games/badugi/utils/deck.js';
import { evaluateHand } from '../../games/badugi/utils/badugiEvaluator.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function previewBadugiPredrawHeroHand({ seed, seatCount, occupiedSeatCount, heroSeat }) {
  if (!Number.isInteger(seed) || ![2, 3, 6].includes(seatCount) ||
      ![2, 3, 6].includes(occupiedSeatCount) || occupiedSeatCount > seatCount ||
      !Number.isInteger(heroSeat) || heroSeat < 0 || heroSeat >= occupiedSeatCount) {
    throw new TypeError('seed screen requires valid seed, seats and occupied hero seat');
  }
  // The v2 controller draws four cards per occupied seat in physical seat
  // order on hand zero. DeckManager and this RNG are the same as its bridge.
  const deck = new DeckManager({ rng: seededRandom(seed) });
  for (let seat = 0; seat < occupiedSeatCount; seat += 1) {
    const cards = deck.draw(4);
    if (seat === heroSeat) return cards;
  }
  throw new Error('hero seat was not dealt');
}

export function classifyBadugiPredrawHeroHand(cards) {
  if (!Array.isArray(cards) || cards.length !== 4) {
    throw new TypeError('seed screen requires four hero cards');
  }
  const evaluated = evaluateHand(cards.map((card) => {
    const match = typeof card === 'string'
      ? card.match(/^(10|[2-9AJQK])([SHDC])$/) : null;
    if (!match) throw new TypeError('seed screen requires standard card labels');
    return { rank: RANKS.indexOf(match[1]) + 1, suit: match[2] };
  }));
  const highRank = evaluated.ranks[evaluated.ranks.length - 1] - 1;
  return { madeCards: evaluated.count, highRank,
    highBand: highRank <= 4 ? 'A-5' : highRank <= 8 ? '6-9' : 'T-K' };
}

export function screenBadugiPredrawSeedRange({ firstSeed, scanCount, seatCount,
  occupiedSeatCount, heroSeat, madeCards, highBand, maxMatches }) {
  if (!Number.isInteger(firstSeed) || firstSeed < 0 ||
      !Number.isInteger(scanCount) || scanCount <= 0 ||
      firstSeed + scanCount > 2 ** 32 ||
      ![2, 3, 4].includes(madeCards) ||
      !['A-5', '6-9', 'T-K'].includes(highBand) ||
      !Number.isInteger(maxMatches) || maxMatches <= 0) {
    throw new TypeError('seed range screen requires bounded unsigned seeds and hand class');
  }
  const selected = [];
  let scanned = 0;
  for (; scanned < scanCount && selected.length < maxMatches; scanned += 1) {
    const seed = firstSeed + scanned;
    const cards = previewBadugiPredrawHeroHand({
      seed, seatCount, occupiedSeatCount, heroSeat,
    });
    const hand = classifyBadugiPredrawHeroHand(cards);
    if (hand.madeCards === madeCards && hand.highBand === highBand) {
      selected.push({ seed, heroSeat, cards, hand });
    }
  }
  return { scanned, selected };
}
