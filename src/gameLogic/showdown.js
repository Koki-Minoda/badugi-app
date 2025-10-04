// src/gameLogic/showdown.js
import { evaluateBadugi } from "../utils/badugi";
import { saveTournamentHistory } from "../utils/history"; // 🧩 追加

export function runShowdown({
  players,
  setPlayers,
  pots,
  setPots,
  dealerIdx,
  dealNewHand,
  setShowNextButton,
}) {
  let updated = players.map((p) => ({ ...p, showHand: !p.folded }));

  pots.forEach((pot) => {
    const eligibleIdx = pot.eligible.filter((i) => !updated[i].folded);
    if (eligibleIdx.length === 0) return;

    const evals = eligibleIdx.map((i) => ({
      idx: i,
      eval: evaluateBadugi(updated[i].hand),
    }));

    const maxScore = Math.max(...evals.map((e) => e.eval.score));
    const candidates = evals.filter((e) => e.eval.score === maxScore);

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

    const share = Math.floor(pot.amount / winners.length);
    winners.forEach((idx) => {
      updated[idx].stack += share;
    });
  });

  setPlayers(updated);
  setPots([]);

  // 🧩 トーナメント履歴保存（暫定データ）
  try {
    const winner = updated.find((p) => !p.folded); // 最後まで残った人
    saveTournamentHistory({
      tsStart: Date.now() - 300000, // 仮: 開始から5分前
      tsEnd: Date.now(),
      tier: "store",
      buyIn: 1000,
      entries: players.length,
      finish: 1,
      prize: 5000,
      hands: [], // 今は未連携
    });
    console.log("✅ Tournament saved to history");
  } catch (err) {
    console.warn("⚠ Failed to save tournament history:", err);
  }

  // 「Next Hand」ボタン表示 & 10秒後に自動進行
  setShowNextButton(true);
  const nextDealer = (dealerIdx + 1) % players.length;

  setTimeout(() => {
    setShowNextButton((visible) => {
      if (visible) {
        dealNewHand(nextDealer);
        return false;
      }
      return false;
    });
  }, 10000);
}
