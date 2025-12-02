import { describe, expect, it } from "vitest";
import { DeckManager, assertNoDuplicateCards } from "../deck.js";

function flattenHands(hands) {
  return hands.reduce((acc, hand) => acc.concat(hand ?? []), []);
}

describe("DeckManager", () => {
  it("deals unique cards to multiple players", () => {
    const dm = new DeckManager();
    const hands = Array.from({ length: 6 }, () => dm.draw(4));
    const dealt = flattenHands(hands);
    expect(new Set(dealt).size).toBe(dealt.length);
    const buckets = { deck: dm.deck, discard: dm.discardPile };
    hands.forEach((hand, idx) => {
      buckets[`seat${idx}`] = hand;
    });
    assertNoDuplicateCards("deal-6x4", buckets);
  });

  it("recycles discarded cards when the deck is exhausted", () => {
    const dm = new DeckManager();
    let hand = dm.draw(10);
    const discarded = hand.slice(0, 5);
    dm.discard(discarded);
    hand = hand.slice(5); // remaining cards still in play
    dm.draw(42); // consume most of the live deck
    dm.recycleIfNeeded(5);
    const recycled = dm.draw(5);
    expect(recycled.length).toBe(5);
    hand.push(...recycled);
    assertNoDuplicateCards("recycle", {
      active: hand,
      deck: dm.deck,
      discard: dm.discardPile,
    });
  });

  it("maintains uniqueness through repeated draw/discard cycles", () => {
    const dm = new DeckManager();
    const handsInPlay = [];
    for (let i = 0; i < 40; i += 1) {
      const cards = dm.draw(3, { allowPartial: true });
      dm.discard(cards.slice(0, 2));
      const kept = cards.slice(2);
      handsInPlay.push(...kept);
      if (handsInPlay.length > 10) {
        dm.discard(handsInPlay.splice(0, handsInPlay.length - 10));
      }
      assertNoDuplicateCards(`loop-${i}`, {
        active: handsInPlay,
        deck: dm.deck,
        discard: dm.discardPile,
      });
    }
  });

  it("ignores alias buckets pointing to the same hand", () => {
    const dm = new DeckManager();
    const hand = dm.draw(4);
    expect(() =>
      assertNoDuplicateCards("alias-hand", {
        deck: dm.deck,
        primary: hand,
        hero: hand,
      }),
    ).not.toThrow();
  });

  it("defers recycling cards that are still marked as active", () => {
    const dm = new DeckManager();
    const hands = [dm.draw(4), dm.draw(4)];
    const leaked = hands[0][0];
    dm.discard([leaked]);
    dm.recycleNow([], { activeCards: hands.flat() });
    expect(dm.deck.includes(leaked)).toBe(false);
    expect(dm.discardPile.includes(leaked)).toBe(true);

    hands[0] = hands[0].slice(1);
    dm.recycleNow([], { activeCards: hands.flat() });
    expect(dm.discardPile.includes(leaked)).toBe(false);

    assertNoDuplicateCards("guard-recycle", {
      deck: dm.deck,
      discard: dm.discardPile,
      seat0: hands[0],
      seat1: hands[1],
    });
  });

  it("moves cards from discard into deck when recycled", () => {
    const dm = new DeckManager();
    const [first, second] = dm.draw(2);
    dm.discard([first, second]);
    dm.recycleNow([], { activeCards: [] });
    expect(dm.discardPile).not.toContain(first);
    expect(dm.discardPile).not.toContain(second);
    expect(dm.deck).toEqual(expect.arrayContaining([first, second]));
    assertNoDuplicateCards("recycle-move", {
      deck: dm.deck,
      discard: dm.discardPile,
    });
  });

  it("keeps active cards in discard when recycling with active set", () => {
    const dm = new DeckManager();
    const [first] = dm.draw(1);
    dm.discard([first]);
    dm.recycleNow([], { activeCards: [first] });
    expect(dm.discardPile).toContain(first);
    expect(dm.deck.filter((card) => card === first).length).toBe(0);
    assertNoDuplicateCards("recycle-active", {
      deck: dm.deck,
      discard: dm.discardPile,
    });
  });

  it("burns once and deals four cards per seat without duplicating cards", () => {
    const dm = new DeckManager();
    dm.reset();
    dm.burnTopCards(1);
    const players = Array.from({ length: 6 }, () => ({ hand: [] }));
    for (let round = 0; round < 4; round += 1) {
      players.forEach((player) => {
        const card = dm.draw(1)?.[0];
        expect(card).toBeTruthy();
        player.hand.push(card);
      });
    }
    const snapshot = {
      deck: dm.deck,
      burn: dm.burnPile,
      discard: dm.discardPile,
      players,
    };
    const totalCards =
      snapshot.deck.length +
      snapshot.burn.length +
      snapshot.discard.length +
      players.reduce((sum, player) => sum + player.hand.length, 0);
    expect(snapshot.burn.length).toBe(1);
    expect(snapshot.discard.length).toBe(0);
    expect(totalCards).toBe(52);
    assertNoDuplicateCards("preflop-deal", {
      deck: snapshot.deck,
      burn: snapshot.burn,
      discard: snapshot.discard,
      ...players.reduce((acc, player, idx) => {
        acc[`seat${idx}`] = player.hand;
        return acc;
      }, {}),
    });
  });
});
