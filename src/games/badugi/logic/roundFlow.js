// src/games/badugi/logic/roundFlow.js
import { debugLog } from "../../../utils/debugLog";

// --- sanitizeStacks: プレイヤーのスタックを補正して all-in化 ---
function sanitizeStacks(snap, setPlayers) {
  const corrected = snap.map(p => {
    if (p.stack <= 0 && !p.allIn) {
      console.warn(`[SANITIZE] ${p.name} stack=${p.stack} → allIn`);
      return { ...p, stack: 0, allIn: true };
    }
    return p;
  });
  if (setPlayers) setPlayers(corrected);
  return corrected;
}


// === 基本ユーティリティ ===
export const alivePlayers = arr =>
  Array.isArray(arr) ? arr.filter(p => !p.folded && !p.allIn) : [];

export const nextAliveFrom = (arr, idx) => {
  const n = arr.length;
  let next = (idx + 1) % n;
  let loop = 0;
  while (arr[next]?.folded || arr[next]?.allIn) {
    next = (next + 1) % n;
    if (++loop > n) return null;
  }
  return next;
};

export const maxBetThisRound = arr => {
  const alive = alivePlayers(arr);
  return alive.length ? Math.max(...alive.map(p => p.betThisRound)) : 0;
};

// === ポット清算 ===
export function settleStreetToPots(playersSnap = [], prevPots = []) {
  debugLog("💰 [SETTLE] start");
  const contrib = playersSnap.map(p => (p.folded ? 0 : Math.max(0, p.betThisRound || 0)));
  const pots = [...prevPots];

  while (true) {
    const pos = contrib.map((v, i) => ({ v, i })).filter(o => o.v > 0 && !playersSnap[o.i].folded);
    if (!pos.length) break;
    const min = Math.min(...pos.map(p => p.v));
    const part = pos.map(p => p.i);
    const amount = min * part.length;
    pots.push({ amount, eligible: part });
    part.forEach(i => (contrib[i] -= min));
  }

  const cleared = playersSnap.map(p => ({ ...p, betThisRound: 0 }));
  return { pots, clearedPlayers: cleared };
}

// === BET終了判定 ===
export const isBetRoundComplete = players => {
  const alive = alivePlayers(players);
  if (alive.length <= 1) return true;
  const maxNow = maxBetThisRound(players);
  return alive.every(p => p.betThisRound === maxNow || p.allIn);
};

// === BET → DRAW/SHOWDOWN ===
export function finishBetRoundFrom({
  players,
  pots,
  setPlayers,
  setPots,
  drawRound,
  setDrawRound,
  setPhase,
  setTurn,
  dealerIdx,
  NUM_PLAYERS,
  MAX_DRAWS,
  runShowdown,
  dealNewHand,
  setShowNextButton,
  setTransitioning,
}) {
  console.log(`[TRACE ${new Date().toISOString()}] ▶ finishBetRoundFrom START`, { drawRound });
  debugLog(`[🏁 BET] finishBetRoundFrom start — drawRound=${drawRound}`);

  // 1️⃣ BET清算
  const { pots: newPots, clearedPlayers } = settleStreetToPots(players, pots);
  setPots(newPots);
  setPlayers(clearedPlayers);

  // 2️⃣ DRAW→BET→SHOWDOWNを正しく分岐
  const nextRound = drawRound + 1;

  if (nextRound > MAX_DRAWS) {
    debugLog("🎯 Final betting complete → SHOWDOWN");
    setPhase("SHOWDOWN");
    runShowdown?.({
      players: clearedPlayers,
      setPlayers,
      pots: newPots,
      setPots,
      dealerIdx,
      dealNewHand,
      setShowNextButton,
    });
    return;
  }

  // 3️⃣ 次はDRAW（左回り：SBスタート）
  const firstToDraw = (dealerIdx + 1) % NUM_PLAYERS; // SB

  // --- 🧩 hasDrawnを必ずfalseに初期化（DRAW#1スキップ防止）---
  const resetPlayers = clearedPlayers.map(p => ({
    ...p,
    hasDrawn: p.folded ? true : false,  // ← foldedは即draw済みに扱う
    lastAction: "",
  }));
  setPlayers(resetPlayers);

  debugLog(`➡️ [FLOW] → DRAW #${nextRound} (SB=${firstToDraw})`);

  // --- 💡 遷移中ブロックをセットして二重発火防止 ---
  if (setTransitioning) {
    setTransitioning(true);
    // DRAW開始直後の誤判定防止のため、解除を少し遅らせる
    setTimeout(() => setTransitioning(false), 500);
  }

  //setDrawRound(nextRound);
  setTurn(firstToDraw);
  setPhase("DRAW");
  debugLog(`[SYNC] Phase=DRAW, round=${nextRound}, start=${firstToDraw}`);
  console.table(
    clearedPlayers.map((p,i)=>({
      seat:i, name:p.name, folded:p.folded?'✓':'', drawn:p.hasDrawn?'✓':''
    }))
  );
  console.log(`[TRACE ${new Date().toISOString()}] ✅ finishBetRoundFrom END → nextPhase=DRAW`);
  // 🩵 全員のスタックを最終確認・補正
  sanitizeStacks(clearedPlayers, setPlayers);
}


// === DRAW開始ヘルパ（App.jsx側からも利用可能） ===
export function startDrawRound({
  players,
  dealerIdx,
  NUM_PLAYERS,
  setPlayers,
  setPhase,
  setDrawRound,
  setTurn,
  onAfter,
}) {
  const reset = players.map(p => ({
    ...p,
    hasDrawn: false,
    lastAction: "",
    betThisRound: 0,
  }));
  setPlayers(reset);
  const next = (dealerIdx + 1) % NUM_PLAYERS; // SB開始
  setDrawRound(r => r + 1);
  setPhase("DRAW");
  setTurn(next);
  debugLog(`[FLOW] startDrawRound → turn=${next}`);
  if (onAfter) onAfter();
}

