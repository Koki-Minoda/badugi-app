// src/games/badugi/engine/drawRound.js
import { findNextActorSeatForPhase } from "../flow/nextActorUtils.js";
import { debugLog } from "../../../utils/debugLog";
import { assertNoDuplicateCards } from "../utils/deck.js";
import { normalizeDiscardIndexes } from "../../core/draw/normalizeDrawAction.js";

/**
 * Deck-managed DRAW round controller.
 * App can pass `advanceAfterAction` to sync GameEngine metadata after each draw.
 */
export function runDrawRound({
  players,
  turn,
  deckManager,
  setPlayers,
  drawRound,
  setTurn,
  advanceAfterAction = () => {},
  onActionLog = () => {},
}) {
  if (!Array.isArray(players)) return;
  debugLog("[DRAW][TRACE]", `runDrawRound START turn=${turn}, drawRound=${drawRound}`);
  const actor = players[turn];
  if (!actor || actor.folded || actor.seatOut || actor.hasDrawn) {
    const nxt = findNextActorSeatForPhase({
      phase: "DRAW",
      players,
      startIdx: (turn ?? 0) + 1,
    });
    if (typeof nxt === "number") {
      setTurn(nxt);
    } else {
      debugLog("[DRAW] No drawable seat found when skipping current actor.");
    }
    return;
  }

  let requestedDrawCount = actor.drawRequest ?? actor.drawCount ?? 0;
  if (turn !== 0 && requestedDrawCount === 0) {
    requestedDrawCount = decideCpuDraw(actor.hand);
  }

  const newHand = [...actor.hand];
  const stackBefore = actor.stack;
  const betBefore = actor.betThisRound;
  const originalHand = [...actor.hand];
  const requestedDiscardIndexes = Array.isArray(actor.discardIndexes)
    ? actor.discardIndexes
    : Array.isArray(actor.drawIndexes)
      ? actor.drawIndexes
      : requestedDrawCount > 0
        ? pickDiscardIndexes(actor.hand, requestedDrawCount)
        : [];
  const normalizedDraw = normalizeDiscardIndexes({
    hand: actor.hand,
    discardIndexes: requestedDiscardIndexes,
    drawCount: requestedDrawCount,
    maxDiscardCount: 4,
  });
  const discardIndexes = normalizedDraw.discardIndexes;
  const drawCount = normalizedDraw.drawCount;
  const activeCards = collectActiveCards(players);
  const drawnCards = deckManager.draw(drawCount, { activeCards });
  const keptCards = originalHand.filter((_, idx) => !discardIndexes.includes(idx));

  const replacedCards = discardIndexes.map((idx, j) => {
    const incoming = drawnCards?.[j];
    if (incoming) {
      if (typeof deckManager.discard === "function") {
        deckManager.discard([newHand[idx]]);
      }
      newHand[idx] = incoming;
      return { index: idx, oldCard: originalHand[idx], newCard: incoming };
    }
    return { index: idx, oldCard: originalHand[idx], newCard: originalHand[idx] };
  });

  const updatedPlayers = players.map((p, i) =>
    i === turn
      ? {
          ...p,
          hand: newHand,
          hasDrawn: true,
          hasActedThisRound: true,
          lastDrawCount: drawCount,
          lastDiscardIndexes: discardIndexes,
          lastAction: drawCount === 0 ? "Pat" : `DRAW(${drawCount})`,
        }
      : p
  );

  setPlayers(updatedPlayers);
  try {
    if (deckManager) {
      assertNoDuplicateCards("[DRAW_ROUND]", {
        deck: deckManager.deck,
        discard: deckManager.discardPile,
        burn: deckManager.burnPile,
        ...playersToSeatBuckets(updatedPlayers),
      });
    }
  } catch (err) {
    console.warn(err);
    throw err;
  }
  advanceAfterAction(updatedPlayers, turn, {
    drawCount,
    discardIndexes,
    discarded: discardIndexes.map((idx) => originalHand[idx]),
    drawn: drawnCards,
    keptCards,
    replacedCards,
    beforeHand: originalHand,
    afterHand: newHand,
    newHand,
    warnings: normalizedDraw.warnings,
  });

  if (typeof onActionLog === "function") {
    onActionLog({
      phase: "DRAW",
      round: drawRound + 1,
      seat: turn,
      type: drawCount === 0 ? "Pat" : `DRAW(${drawCount})`,
      stackBefore,
      stackAfter: stackBefore,
      betBefore,
      betAfter: betBefore,
      metadata: {
        drawInfo: {
          drawCount,
          discardIndexes,
          drawIndexes: discardIndexes,
          discarded: discardIndexes.map((idx) => originalHand[idx]),
          drawn: drawnCards,
          keptCards,
          replacedCards,
          before: originalHand,
          after: newHand,
          beforeHand: originalHand,
          afterHand: newHand,
          warnings: normalizedDraw.warnings,
        },
      },
    });
  }

  const nextIdx = findNextActorSeatForPhase({
    phase: "DRAW",
    players: updatedPlayers,
    startIdx: (turn ?? 0) + 1,
  });

  if (typeof nextIdx === "number") {
    setTurn(nextIdx);
  } else {
    debugLog(`[DRAW] All active players have drawn (round=${drawRound}).`);
  }

  debugLog("[DRAW][TRACE]", `runDrawRound END turn=${turn}`);
}

export function runDrawRoundSafe(options) {
  const { players, turn } = options;
  if (!Array.isArray(players)) return;
  const actor = players[turn];
  if (!actor || actor.folded || actor.seatOut || actor.hasDrawn) return;
  runDrawRound(options);
}

function decideCpuDraw(hand = []) {
  const suits = new Set();
  const ranks = new Set();
  hand.forEach((card) => {
    suits.add(card?.slice(-1));
    ranks.add(card?.slice(0, -1));
  });
  const uniqueCount = Math.min(suits.size, ranks.size);
  return Math.min(Math.max(0, 4 - uniqueCount), 3);
}

function pickDiscardIndexes(hand = [], drawCount = 0) {
  const rankCount = {};
  const suitCount = {};
  hand.forEach((card) => {
    const rank = card?.slice(0, -1);
    const suit = card?.slice(-1);
    rankCount[rank] = (rankCount[rank] || 0) + 1;
    suitCount[suit] = (suitCount[suit] || 0) + 1;
  });
  const rankOrder = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  return hand
    .map((card, i) => {
      const rank = card?.slice(0, -1);
      const suit = card?.slice(-1);
      let score = 0;
      if (rankCount[rank] > 1) score += 2;
      if (suitCount[suit] > 1) score += 1;
      score += rankOrder.indexOf(rank) / 13;
      return { i, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, drawCount)
    .map((entry) => entry.i);
}

function playersToSeatBuckets(players = []) {
  return players.reduce((acc, player, idx) => {
    acc[`seat${idx}`] = player?.hand ?? [];
    return acc;
  }, {});
}

function collectActiveCards(players = []) {
  const cards = [];
  players.forEach((player) => {
    if (Array.isArray(player?.hand) && player.hand.length) {
      cards.push(...player.hand);
    }
  });
  return cards;
}
