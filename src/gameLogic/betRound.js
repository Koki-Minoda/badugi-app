// src/gameLogic/betRound.js
import { evaluateBadugi } from "../utils/badugi";

/**
 * BET round driver for the legacy NPC flow.
 * - Next actor is always the next alive seat after `turn` (provided by the parent via getNextAliveAfter).
 * - Fixed limit: every raise uses `betSize`.
 * - All-in aware: payments never exceed the stack; reaching zero stack sets `allIn=true`.
 * - Completion: all active players must have matching `betThisRound` and `actedThisRound=true`, then we move to DRAW (starting from SB).
 */
export function runBetRound({
  players,
  turn,
  dealerIdx,
  betSize,
  setPlayers,
  setCurrentBet,
  setPhase,
  setTurn,
  getNextAliveAfter, // Provided by App
}) {
  const active = players.filter((p) => !p.folded);
  if (active.length <= 1) {
    setPhase("DRAW");
    setTurn((dealerIdx + 1) % players.length); // SB
    return;
  }

  const current = players[turn];
  if (!current || current.folded) {
    const next = getNextAliveAfter(turn, players);
    if (next !== null) setTurn(next);
    return;
  }

  // Hero actions are handled in App.jsx, so this branch just advances the turn.
  if (turn === 0) {
    const stillActive = players.filter((pl) => !pl.folded);
    const maxNow = Math.max(...stillActive.map((pl) => pl.betThisRound));
    const everyoneMatched = stillActive.every((pl) => pl.betThisRound === maxNow);
    const everyoneActed = stillActive.every((pl) => pl.actedThisRound);

    if (everyoneMatched && everyoneActed) {
      setPhase("DRAW");
      setTurn((dealerIdx + 1) % players.length);
      return;
    }
    const next = getNextAliveAfter(turn, players);
    if (next !== null) setTurn(next);
    return;
  }

  // --- NPC auto action ---
  setTimeout(() => {
    const newPlayers = [...players];
    const p = { ...newPlayers[turn] };

    const stillActiveBefore = newPlayers.filter((pl) => !pl.folded);
    const maxBet = Math.max(...stillActiveBefore.map((pl) => pl.betThisRound));
    const toCall = Math.max(0, maxBet - p.betThisRound);
    const evalResult = evaluateBadugi(p.hand);
    const madeCards = evalResult.ranks.length;

    if (evalResult.isBadugi || madeCards >= 3 || Math.random() > 0.45) {
      // Call / Check
      if (toCall > 0) {
        const pay = Math.min(p.stack, toCall); // All-in aware
        p.stack -= pay;
        p.betThisRound += pay;
        p.lastAction = pay < toCall ? "Call (All-in)" : "Call";
        if (p.stack === 0) p.allIn = true;
      } else {
        p.lastAction = "Check";
      }

      // Occasionally raise if there is stack left.
      if (!p.allIn && Math.random() > 0.85 && madeCards >= 3) {
        const raiseAmt = betSize; // fixed limit
        const pay = Math.min(p.stack, raiseAmt);
        p.stack -= pay;
        p.betThisRound += pay;
        p.lastAction = pay < raiseAmt ? "Raise (All-in)" : "Raise";
        if (p.stack === 0) p.allIn = true;
      }
    } else {
      // Fold
      p.folded = true;
      p.lastAction = "Fold";
    }

    p.actedThisRound = true;
    newPlayers[turn] = p;
    setPlayers(newPlayers);

    // Completion check
    const stillActive = newPlayers.filter((pl) => !pl.folded);
    const maxNow = Math.max(...stillActive.map((pl) => pl.betThisRound));
    const everyoneMatched = stillActive.every((pl) => pl.betThisRound === maxNow);
    const everyoneActed = stillActive.every((pl) => pl.actedThisRound);

    // Keep UI in sync with the current max bet
    setCurrentBet(maxNow);

    if (everyoneMatched && everyoneActed) {
      setPhase("DRAW");
      setTurn((dealerIdx + 1) % newPlayers.length); // SB
      return;
    }

    const next = getNextAliveAfter(turn, newPlayers);
    if (next !== null) setTurn(next);
  }, 280);
}
