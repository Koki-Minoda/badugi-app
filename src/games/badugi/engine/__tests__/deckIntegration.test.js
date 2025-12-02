import { describe, it, expect } from "vitest";
import { DeckManager, assertNoDuplicateCards } from "../../utils/deck.js";
import { runDrawRound } from "../drawRound.js";

const NUM_PLAYERS = 6;
const DRAW_ROUNDS = 3;

function createPlayers(deck) {
  return Array.from({ length: NUM_PLAYERS }, (_, seat) => ({
    seat,
    name: `Seat ${seat}`,
    seatOut: false,
    folded: false,
    hasDrawn: false,
    drawRequest: seat === 0 ? 2 : 0,
    hand: deck.draw(4),
  }));
}

function clonePlayers(next) {
  return next.map((player) => ({
    ...player,
    hand: Array.isArray(player.hand) ? [...player.hand] : [],
  }));
}

describe("Badugi deck integration", () => {
  it("keeps cards unique across many hands and draw rounds", () => {
    const dm = new DeckManager();
    const HANDS = 120;
    for (let hand = 0; hand < HANDS; hand += 1) {
      dm.reset();
      let players = createPlayers(dm);
      assertNoDuplicateCards(`[HAND ${hand}] deal`, {
        deck: dm.deck,
        discard: dm.discardPile,
        burn: dm.burnPile,
        ...playersToSeatBuckets(players),
      });

      let turn = 0;
      for (let round = 0; round < DRAW_ROUNDS; round += 1) {
        players = players.map((player) => ({
          ...player,
          hasDrawn: false,
          drawRequest: player.seat === 0 ? Math.floor(Math.random() * 4) : player.drawRequest,
        }));
        for (let actions = 0; actions < NUM_PLAYERS; actions += 1) {
          runDrawRound({
            players,
            turn,
            deckManager: dm,
            setPlayers: (next) => {
              players = clonePlayers(next);
            },
            drawRound: round,
            setTurn: (nextTurn) => {
              if (typeof nextTurn === "number") {
                turn = nextTurn;
              }
            },
            dealerIdx: 0,
            NUM_PLAYERS,
            advanceAfterAction: () => {},
            onActionLog: () => {},
          });
        }
        assertNoDuplicateCards(`[HAND ${hand}] draw-round ${round}`, {
          deck: dm.deck,
          discard: dm.discardPile,
          burn: dm.burnPile,
          ...playersToSeatBuckets(players),
        });
      }

      const totalCards =
        players.reduce((sum, player) => sum + (player.hand?.length ?? 0), 0) +
        dm.deck.length +
        dm.discardPile.length +
        dm.burnPile.length;
      expect(totalCards).toBeLessThanOrEqual(52);
    }
  });
});

function playersToSeatBuckets(players = []) {
  return players.reduce((acc, player, idx) => {
    acc[`seat${idx}`] = player?.hand ?? [];
    return acc;
  }, {});
}
