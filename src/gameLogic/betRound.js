// src/gameLogic/betRound.js
import { evaluateBadugi } from "../utils/badugi";

/**
 * BETラウンド進行（NPC用）
 * - 次アクターは必ず「現在 turn の次」（親から getNextAliveAfter を受け取る）
 * - Fixed Limit：raiseAmt は betSize に固定
 * - All-in 対応：支払いは stack を超えない。stack が 0 になったら allIn=true
 * - 終了条件：「アクティブ全員の betThisRound が同額」かつ「全員 actedThisRound=true」
 *   → 即 DRAW へ（SB から）
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
  getNextAliveAfter, // 親(App)から渡す
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

  // 自分(0)の手番ではここではアクションをしない（App 側が既に処理）
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

  // --- NPC 自動アクション ---
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
        const pay = Math.min(p.stack, toCall); // All-in 対応
        p.stack -= pay;
        p.betThisRound += pay;
        p.lastAction = pay < toCall ? "Call (All-in)" : "Call";
        if (p.stack === 0) p.allIn = true;
      } else {
        p.lastAction = "Check";
      }

      // 小確率で Raise（残スタックがあれば）
      if (!p.allIn && Math.random() > 0.85 && madeCards >= 3) {
        const raiseAmt = betSize; // ★ 固定リミット
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

    // 終了条件
    const stillActive = newPlayers.filter((pl) => !pl.folded);
    const maxNow = Math.max(...stillActive.map((pl) => pl.betThisRound));
    const everyoneMatched = stillActive.every((pl) => pl.betThisRound === maxNow);
    const everyoneActed = stillActive.every((pl) => pl.actedThisRound);

    // UI用 currentBet を更新（最大額）
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
