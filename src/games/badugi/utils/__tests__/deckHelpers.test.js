import { describe, expect, it } from "vitest";
import { DeckManager } from "../deck.js";
import { dealInitialHands, validatePreflopState } from "../deckHelpers.js";

describe("dealInitialHands", () => {
  it("deals four cards per active seat and preserves 52-card integrity", () => {
    const deckManager = new DeckManager();
    deckManager.reset();
    if (typeof deckManager.shuffle === "function") {
      deckManager.shuffle();
    }
    if (typeof deckManager.burnTopCards === "function") {
      deckManager.burnTopCards(1);
    }

    const seats = Array.from({ length: 6 }, (_, seatIndex) => ({
      seatIndex,
      seatOut: false,
    }));

    const { hands } = dealInitialHands({
      deckManager,
      seats,
      dealerIdx: 0,
      cardsPerPlayer: 4,
    });

    hands.forEach((hand) => {
      expect(hand).toHaveLength(4);
    });

    const playersForValidation = hands.map((hand) => ({ hand }));
    const preflopState = validatePreflopState({
      deck: deckManager.deck,
      burn: deckManager.burnPile,
      discard: deckManager.discardPile,
      players: playersForValidation,
    });

    expect(preflopState.isValidTotal).toBe(true);
    expect(preflopState.total).toBe(52);
    expect(preflopState.hasSingleBurn).toBe(true);
    expect(preflopState.handCount).toBe(24);
  });
});
