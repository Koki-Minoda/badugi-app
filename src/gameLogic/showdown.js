// src/gameLogic/showdown.js
import { evaluateBadugi } from "../utils/badugi";

/**
 * サイドポット込みのショーダウン処理（同点チョップあり）
 * - pots: [{ amount, eligible: [playerIdx...] }, ...]
 * - eligible 内のプレイヤーだけで勝敗を判定し、amount を山分け
 * - 終了後は「Next Hand」ボタンを表示し、10秒後に自動で次のハンドへ
 */
export function runShowdown({
  players,
  setPlayers,
  pots,
  setPots,
  dealerIdx,
  dealNewHand,
  setShowNextButton,
}) {
  // 全員のハンドを公開（フォールド者は表示でも勝負からは除外）
  let updated = players.map((p) => ({ ...p, showHand: !p.folded }));

  pots.forEach((pot) => {
    const eligibleIdx = pot.eligible.filter((i) => !updated[i].folded);
    if (eligibleIdx.length === 0) return;

    // Badugi評価
    const evals = eligibleIdx.map((i) => ({
      idx: i,
      eval: evaluateBadugi(updated[i].hand),
    }));
    const maxScore = Math.max(...evals.map((e) => e.eval.score));
    const candidates = evals.filter((e) => e.eval.score === maxScore);

    // 低い方が強い（ranksAsc）を高位から比較
    candidates.sort((a, b) => {
      const ra = a.eval.ranksAsc.slice().reverse();
      const rb = b.eval.ranksAsc.slice().reverse();
      for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
        const va = ra[i] ?? 0;
        const vb = rb[i] ?? 0;
        if (va < vb) return -1;
        if (va > vb) return 1;
      }
      return 0;
    });

    const bestEval = candidates[0].eval;
    const winners = candidates
      .filter((c) => {
        const ra = c.eval.ranksAsc.slice().reverse();
        const rb = bestEval.ranksAsc.slice().reverse();
        if (ra.length !== rb.length) return false;
        for (let i = 0; i < ra.length; i++) {
          if (ra[i] !== rb[i]) return false;
        }
        return true;
      })
      .map((c) => c.idx);

    // pot を山分け（端数は切り捨て）
    const share = Math.floor(pot.amount / winners.length);
    winners.forEach((idx) => {
      updated[idx].stack += share;
    });
  });

  setPlayers(updated);
  setPots([]);

  // 「Next Hand」ボタン表示 & 10秒後に自動進行
  setShowNextButton(true);
  const nextDealer = (dealerIdx + 1) % players.length;

  setTimeout(() => {
    // まだ次ハンドに行っていなければ自動進行
    setShowNextButton((visible) => {
      if (visible) {
        dealNewHand(nextDealer);
        return false;
      }
      return false;
    });
  }, 10000);
}
