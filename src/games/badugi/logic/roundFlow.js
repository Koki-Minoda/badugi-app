// src/games/badugi/logic/roundFlow.js
import { debugLog } from "../../../utils/debugLog";

// --- sanitizeStacks: プレイヤーのスタックを補正して all-in化 ---
function sanitizeStacks(snap, setPlayers) {
  const corrected = snap.map(p => {
    if (p.stack <= 0 && !p.allIn) {
      console.warn(`[SANITIZE] ${p.name} stack=${p.stack} → allIn`);
      return { ...p, stack: 0, allIn: true, hasDrawn: true, isBusted: true };
    }
    if (p.stack <= 0 && p.isBusted !== true) {
      return { ...p, isBusted: true };
    }
    if (p.stack > 0 && p.isBusted) {
      return { ...p, isBusted: false };
    }
    return p;
  });
  if (setPlayers) setPlayers(corrected);

  // ★ デバッグ出力
  console.table(corrected.map((p, i) => ({
    i,
    name: p.name,
    allIn: p.allIn,
    hasDrawn: p.hasDrawn,
    stack: p.stack,
    folded: p.folded,
  })));
  return corrected;
}


// === 基本ユーティリティ ===
// --- BET用（all-in除外）---
export const aliveBetPlayers = arr =>
  Array.isArray(arr) ? arr.filter(p => !p.folded && !p.allIn) : [];

// --- DRAW用（all-in含む）---
export const aliveDrawPlayers = arr =>
  Array.isArray(arr) ? arr.filter(p => !p.folded) : [];

// 互換用（App.jsx が alivePlayers を import している）
export const alivePlayers = aliveBetPlayers;

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
  if (!Array.isArray(arr)) return 0;
  const eligible = arr.filter(p => !p.folded);
  if (!eligible.length) return 0;
  return Math.max(...eligible.map(p => p.betThisRound || 0));
};

export const calcDrawStartIndex = (dealerIdx = 0, streetIndex = 0, numPlayers = 6) => {
  // DRAWは常にSB（ディーラー左）から開始。streetIndexは拡張用に保持。
  void streetIndex;
  return (dealerIdx + 1) % numPlayers;
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
  if (!Array.isArray(players)) return false;
  const active = players.filter(p => !p.folded);
  if (active.length <= 1) return true;
  const maxNow = Math.max(...active.map(p => p.betThisRound || 0));
  return active.every(p => p.allIn || (p.betThisRound || 0) === maxNow);
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
  console.log("[DEBUG][finishBetRoundFrom args]", {
    phaseBefore: "BET",
    dealerIdx,
    drawRound,
    typeofDrawRound: typeof drawRound,
    MAX_DRAWS,
    playerStates: players.map((p, i) => ({
      i,
      name: p.name,
      folded: p.folded,
      allIn: p.allIn,
      betThisRound: p.betThisRound,
    })),
  });

  if (typeof drawRound === "undefined" || isNaN(drawRound)) {
    console.warn("[finishBetRoundFrom] drawRound undefined, defaulting to 0");
    drawRound = 0;

  }
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

  // 3️⃣ 次はDRAWへ。calcDrawStartIndexで起点を統一
  const baseDrawStart = calcDrawStartIndex(dealerIdx, nextRound, NUM_PLAYERS);
  let firstToDraw = baseDrawStart;
  let found = false;
  for (let i = 0; i < NUM_PLAYERS; i++) {
    const idx = (baseDrawStart + i) % NUM_PLAYERS;
    const p = clearedPlayers[idx];
    if (!p.folded) {
      firstToDraw = idx;
      found = true;
      break;
    }
  }
  if (!found) {
    console.error("[finishBetRoundFrom] No non-folded players found → abort");
    return;
  }

  // --- 🧩 hasDrawnを必ずfalseに初期化（DRAW#1スキップ防止）---
  const resetPlayers = clearedPlayers.map(p => ({
    ...p,
    hasDrawn: p.folded ? true : false,  // ← foldedは即draw済みに扱う
    canDraw: !p.folded,
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

  setTurn(firstToDraw);
  setPhase("DRAW");
  debugLog(`[SYNC] Phase=DRAW, round=${nextRound}, start=${firstToDraw}`);
  console.table(
    resetPlayers.map((p,i)=>({
      seat:i, name:p.name, folded:p.folded?'✓':'', drawn:p.hasDrawn?'✓':''
    }))
  );
  console.log(`[TRACE ${new Date().toISOString()}] ✅ finishBetRoundFrom END → nextPhase=DRAW`);

  // finishBetRoundFrom の末尾、sanitizeStacks の直前に追加
  console.groupCollapsed("[DEBUG][AFTER ROUND TRANSITION]");
  console.table(resetPlayers.map((p, i) => ({
    seat: i,
    name: p.name,
    folded: p.folded,
    allIn: p.allIn,
    hasDrawn: p.hasDrawn,
    canDraw: p.canDraw,
    stack: p.stack,
    lastAction: p.lastAction,
  })));
  console.groupEnd();

  // 🩵 全員のスタックを最終確認・補正
  sanitizeStacks(resetPlayers, setPlayers);
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

