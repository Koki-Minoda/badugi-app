// src/gameLogic/roundFlow.js
// ラウンド制御の純関数群（React stateに依存しない）

export const alivePlayers = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter((p) => !p.folded);
};

export const nextAliveFrom = (arr, idx) => {
  const n = arr.length;
  let next = (idx + 1) % n;
  let safety = 0;
  while (arr[next]?.folded) {
    next = (next + 1) % n;
    safety++;
    if (safety > n) return null;
  }
  return next;
};

export const maxBetThisRound = (arr) => {
  const alive = alivePlayers(arr);
  if (alive.length === 0) return 0;
  return Math.max(...alive.map((p) => p.betThisRound));
};

const arrayEqUnordered = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
};

/**
 * ストリートの賭け金をポットへ清算（サイドポット対応）
 * playersSnap: スナップショット（folded/ betThisRound を参照）
 * prevPots: 既存のポット配列 [{amount, eligible:[idx...]}]
 * 戻り: { pots, clearedPlayers }
 */
export function settleStreetToPots(playersSnap, prevPots) {
  const contrib = playersSnap.map((p) =>
    p.folded ? 0 : Math.max(0, p.betThisRound || 0)
  );
  const newPots = [...prevPots];

  while (true) {
    const positive = contrib
      .map((v, i) => ({ v, i }))
      .filter(({ v, i }) => v > 0 && !playersSnap[i].folded);

    if (positive.length === 0) break;

    const minLayer = Math.min(...positive.map((x) => x.v));
    const participants = positive.map((x) => x.i);
    const amount = minLayer * participants.length;

    const last = newPots[newPots.length - 1];
    const sameEligible = last && arrayEqUnordered(last.eligible, participants);

    if (sameEligible) last.amount += amount;
    else newPots.push({ amount, eligible: participants.slice().sort((a, b) => a - b) });

    participants.forEach((idx) => {
      contrib[idx] -= minLayer;
    });
  }

  const clearedPlayers = playersSnap.map((p) => ({ ...p, betThisRound: 0 }));
  return { pots: newPots, clearedPlayers };
}

/**
 * BET終了条件（全員一致 or All-inでこれ以上動かない）
 */
export function isBetRoundComplete(playersSnap) {
  const alive = alivePlayers(playersSnap);
  if (alive.length <= 1) return true;
  const maxNow = maxBetThisRound(playersSnap);
  return alive.every((p) => p.betThisRound === maxNow || p.allIn);
}
