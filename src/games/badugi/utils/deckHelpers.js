import { DeckManager } from "./deck.js";

function ensureDeckManager(instance) {
  if (instance instanceof DeckManager) return instance;
  return null;
}

function buildDealOrder(seats = [], dealerIdx = 0) {
  const numSeats = seats.length;
  if (numSeats === 0) return [];
  const start = ((dealerIdx + 1) % numSeats + numSeats) % numSeats;
  const order = [];
  for (let offset = 0; offset < numSeats; offset += 1) {
    const seatIndex = (start + offset) % numSeats;
    const seat = seats[seatIndex] ?? {};
    if (!seat.seatOut) {
      order.push(seatIndex);
    }
  }
  return order;
}

export function dealInitialHands({
  deckManager,
  seats = [],
  dealerIdx = 0,
  cardsPerPlayer = 4,
} = {}) {
  const dm = ensureDeckManager(deckManager);
  const numSeats = seats.length;
  const hands = Array.from({ length: numSeats }, () => []);
  if (!dm || numSeats === 0) {
    return {
      hands,
      burn: [],
      remainingDeck: [],
    };
  }

  const order = buildDealOrder(seats, dealerIdx);
  if (!order.length) {
    return {
      hands,
      burn: dm.burnPile ? [...dm.burnPile] : [],
      remainingDeck: [...dm.deck],
    };
  }

  for (let round = 0; round < cardsPerPlayer; round += 1) {
    order.forEach((seatIndex) => {
      const drawn = dm.draw?.(1);
      const card = drawn?.[0];
      if (!card) {
        throw new Error("[DECK] Exhausted while dealing initial hands");
      }
      hands[seatIndex].push(card);
    });
  }

  return {
    hands,
    burn: dm.burnPile ? [...dm.burnPile] : [],
    remainingDeck: [...dm.deck],
  };
}

export function validatePreflopState({
  deck = [],
  burn = [],
  discard = [],
  players = [],
} = {}) {
  const deckCount = Array.isArray(deck) ? deck.length : 0;
  const burnCount = Array.isArray(burn) ? burn.length : 0;
  const discardCount = Array.isArray(discard) ? discard.length : 0;
  const handCount = Array.isArray(players)
    ? players.reduce((sum, player) => sum + (player?.hand?.length ?? 0), 0)
    : 0;
  const total = deckCount + burnCount + discardCount + handCount;
  return {
    deckCount,
    burnCount,
    discardCount,
    handCount,
    total,
    isValidTotal: total === 52,
    hasSingleBurn: burnCount === 1,
    hasEmptyDiscard: discardCount === 0,
  };
}
