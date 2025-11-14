// src/games/badugi/logic/drawRound.js
import { nextAliveFrom, aliveDrawPlayers } from "./roundFlow";
import { debugLog } from "../../../utils/debugLog";

/**
 * DRAW round controller (DeckManager aware).
 * - Uses the provided deckManager instance as the single source of truth.
 * - App no longer needs to keep its own deck copy.
 */
export function runDrawRound({
  players,
  turn,
  deckManager, 
  setPlayers,
  drawRound,
  setTurn,
  dealerIdx,
  NUM_PLAYERS,
  advanceAfterAction, 
  onActionLog,
}) {
  console.log(`[TRACE ${new Date().toISOString()}] runDrawRound START turn=${turn}, drawRound=${drawRound}`);
  const actor = players?.[turn];
  if (!actor) return;

  // Skip folded / all-in / already-drawn players.
  if (actor.folded || actor.allIn || actor.hasDrawn) {
    debugLog(`[DRAW] skip ${actor?.name} (folded/all-in/already drawn)`);
    const next = nextAliveFrom(players, turn);
    if (next !== null) setTurn(next);
    return;
  }

  // Decide how many cards an NPC draws.
  let drawCount = actor.drawRequest ?? 0;
  if (turn !== 0 && drawCount === 0) {
    drawCount = decideCpuDraw(actor.hand);
  }

  // --- Pull cards from the deck safely ---
  const newHand = [...actor.hand];
  const stackBefore = actor.stack;
  const betBefore = actor.betThisRound;
  const originalHand = [...actor.hand];
  const discardIndexes = pickDiscardIndexes(actor.hand, drawCount);

  const drawnCards = deckManager.draw(drawCount); // DeckManager controls the deck state
  discardIndexes.forEach((idx, j) => {
    const newCard = drawnCards[j];
    newHand[idx] = newCard;
  });

  debugLog(
    `[DRAW] ${actor.name} exchanged ${drawCount} card(s) -> ${newHand.join(", ")}`
  );

  // --- Update player state ---
  const updatedPlayers = players.map((p, i) =>
    i === turn
      ? {
          ...p,
          hand: newHand,
          hasDrawn: true,
          lastDrawCount: drawCount,
          lastAction: drawCount === 0 ? "Pat" : `DRAW(${drawCount})`,
        }
      : p
  );

  setPlayers([...updatedPlayers]);

  if (typeof onActionLog === "function") {
    const replacedCards = discardIndexes.map((idx, j) => ({
      index: idx,
      oldCard: originalHand[idx],
      newCard: drawnCards?.[j] ?? originalHand[idx],
    }));
    onActionLog({
      phase: "DRAW",
      round: drawRound + 1,
      seat: turn,
      type: drawCount === 0 ? "Pat" : `DRAW(${drawCount})`,
      stackBefore,
      stackAfter: stackBefore,
      betBefore,
      betAfter: actor.betThisRound,
      metadata: {
        drawInfo: {
          drawCount,
          replacedCards,
          before: originalHand,
          after: newHand,
        },
      },
    });
  }

  // --- Find the next player who still needs to draw (SB-first order) ---
  const activeForDraw = aliveDrawPlayers(updatedPlayers);
  const sb = (dealerIdx + 1) % NUM_PLAYERS;
  const order = Array.from({ length: NUM_PLAYERS }, (_, k) => (sb + k) % NUM_PLAYERS);
  const nextIdx = order.find(
    (i) => activeForDraw.some(p => updatedPlayers.indexOf(p) === i && !p.hasDrawn)
  );

  if (nextIdx !== -1) {
    setTurn(nextIdx);
  } else {
    debugLog(`[DRAW] All active players have drawn (round=${drawRound}).`);
    // App.finishDrawRound() will advance to the next betting street.
  }
  console.log(`[TRACE ${new Date().toISOString()}] runDrawRound END turn=${turn}`);
}

/**
 * markPlayerDrew()
 * - Marks the given player as done drawing.
 * - Does not advance the round; App calls finishDrawRound() explicitly.
 */
export function markPlayerDrew(setPlayers, playerIdx, numCards = 0) {
  setPlayers((prev) =>
    prev.map((p, i) =>
      i === playerIdx
        ? {
            ...p,
            hasDrawn: true,
            lastDrawCount: numCards,
            lastAction: numCards === 0 ? "Pat" : `DRAW(${numCards})`,
          }
        : p
    )
  );
  debugLog(`[DRAW] markPlayerDrew(): seat=${playerIdx}, count=${numCards}`);
}


/**
 * runDrawRoundSafe()
 * - Thin wrapper around runDrawRound().
 * - Only processes players who still have `hasDrawn=false`.
 * - Useful for preventing DRAW#1 skips when manually stepping.
 */
export function runDrawRoundSafe({
  players,
  turn,
  deckManager,
  setPlayers,
  drawRound,
  setTurn,
  dealerIdx,
  NUM_PLAYERS,
}) {
  const actor = players?.[turn];
  if (!actor || actor.hasDrawn || actor.folded || actor.allIn) return;
  runDrawRound({
    players,
    turn,
    deckManager,
    setPlayers,
    drawRound,
    setTurn,
    dealerIdx,
    NUM_PLAYERS,
  });
}

/** NPC draw heuristic (max 3 cards, based on duplicate ranks/suits). */
function decideCpuDraw(hand) {
  const suits = new Set();
  const ranks = new Set();
  for (const card of hand) {
    const s = card.slice(-1);
    const r = card.slice(0, -1);
    suits.add(s);
    ranks.add(r);
  }
  const uniqueCount = Math.min(suits.size, ranks.size);
  const drawCount = Math.max(0, 4 - uniqueCount);
  return Math.min(drawCount, 3);
}

/** Pick discard indexes (badugi-weaker cards first). */
function pickDiscardIndexes(hand, drawCount) {
  // Prioritize removing rank/suit duplicates (spades > hearts > diamonds > clubs fallback)
  const rankCount = {};
  const suitCount = {};
  hand.forEach((c) => {
    const r = c.slice(0, -1);
    const s = c.slice(-1);
    rankCount[r] = (rankCount[r] || 0) + 1;
    suitCount[s] = (suitCount[s] || 0) + 1;
  });

  const rankOrder = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const scored = hand.map((c, i) => {
    const r = c.slice(0, -1);
    const s = c.slice(-1);
    // Prefer dropping duplicate rank/suit cards first
    let score = 0;
    if (rankCount[r] > 1) score += 2;
    if (suitCount[s] > 1) score += 1;
    // Higher ranks are worse (A best -> K worst)
    score += rankOrder.indexOf(r) / 13;
    return { i, score };
  });

  // Discard highest scores first
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, drawCount).map(x => x.i);
}
