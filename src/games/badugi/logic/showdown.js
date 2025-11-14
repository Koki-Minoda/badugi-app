// src/games/badugi/logic/showdown.js
import { evaluateHand, getWinners } from "../utils/handRankings";
import { saveTournamentHistory, saveHandHistory } from "../../../utils/history";

export function runShowdown({
  players,
  setPlayers,
  pots,
  setPots,
  dealerIdx,
  dealNewHand,
  setShowNextButton,
  setPhase,
  setDrawRound,
  setTurn,
  setTransitioning,
  setCurrentBet,   
}) {
  let updated = players.map((p) => ({ ...p, showHand: !p.folded }));
  const totalPot = pots.reduce((s, p) => s + p.amount, 0);

  pots.forEach((pot) => {
    const eligibleIdx = pot.eligible.filter((i) => !updated[i].folded);
    if (eligibleIdx.length === 0) return;

    const evals = eligibleIdx.map((i) => ({
      idx: i,
      eval: evaluateHand("badugi", updated[i].hand),
    }));

    // === ログ出力 ===
    console.groupCollapsed(`[SHOWDOWN LOG] Pot ${pot.amount} → Evaluation`);
    for (const e of evals) {
      const p = updated[e.idx];
      console.log(
        `🃏 ${p.name}: ${p.hand.join(" ")} | type=${e.eval.rankType} | ranks=${e.eval.ranks.join("-")}`
      );
    }
    console.groupEnd();

    // --- 勝者決定 (統一API使用) ---
    const eligiblePlayers = eligibleIdx.map((i) => ({
      name: updated[i].name,
      seat: i,
      hand: updated[i].hand,
    }));
    const winnersData = getWinners("badugi", eligiblePlayers);
    const winners = winnersData.map((w) => w.seat);

    console.log(`🏆 Winners: ${winnersData.map((w) => w.name).join(", ")}`);

    if (winners.length === 0) {
      console.warn(`[SHOWDOWN] ❌ No winners found (pot=${pot.amount})`);
      return;
    }

    // --- 分配 ---
    const share = Math.floor(pot.amount / winners.length);
    winners.forEach((idx) => {
      updated[idx].stack += share;
    });

    console.log(
      `[SHOWDOWN] pot=${pot.amount} → winners=[${winners.join(", ")}], share=${share}`
    );
  });

  updated = updated.map((p) => ({
    ...p,
    isBusted: p.stack <= 0,
  }));

  // --- 状態更新 ---
  setPlayers([...updated]);
  setPots([]);

  // --- 履歴保存 ---
  try {
    saveHandHistory({
      ts: Date.now(),
      dealerIdx,
      players: updated.map((p, i) => ({
        name: p.name,
        seat: i,
        stack: p.stack,
        folded: p.folded,
      })),
      pot: totalPot,
    });
  } catch (err) {
    console.warn("⚠ Failed to save hand history:", err);
  }

  try {
    saveTournamentHistory({
      tsStart: Date.now() - 300000,
      tsEnd: Date.now(),
      tier: "store",
      buyIn: 1000,
      entries: players.length,
      finish: 1,
      prize: 5000,
    });
  } catch (err) {
    console.warn("⚠ Failed to save tournament history:", err);
  }

  // --- 次ハンドへ ---
  setShowNextButton(true);
  const nextDealer = (dealerIdx + 1) % players.length;
  // 🔹 Next Hand ボタンで実行
  window.nextHandTrigger = () => {
  console.log("🔄 Resetting state before next hand...");

  // 💥 前ゲーム状態を完全リセット
  setPhase("INIT");
  setDrawRound(0);
  setTransitioning(false);
  setTurn(null);
  setPots([]);
  setCurrentBet(0);
  setPlayers(players.map(p => ({
    ...p,
    betThisRound: 0,
    folded: false,
    hasDrawn: false,
    drawn: "",
    allIn: false,
    showHand: false,
  })));

  dealNewHand(nextDealer, updated.map(p => ({ ...p })));
  setShowNextButton(false);
  delete window.nextHandTrigger;
  };

console.log("🕒 Waiting for next hand start — click 'Next Hand' button.");
}
