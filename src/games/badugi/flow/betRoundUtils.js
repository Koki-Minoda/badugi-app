import { isFoldedOrOut, nextAliveFrom, maxBetThisRound } from "./actionUtils.js";

export function isBetRoundComplete(players) {
  if (!Array.isArray(players)) return false;
  const active = players.filter((p) => !isFoldedOrOut(p));
  if (active.length <= 1) return true;
  const maxNow = Math.max(...active.map((p) => p.betThisRound || 0));
  return active.every((p) => {
    const matched = p.allIn || (p.betThisRound || 0) === maxNow;
    const acted = p.allIn || p.hasActedThisRound === true;
    return matched && acted;
  });
}

export function closingSeatForAggressor(players, lastAggressorIdx) {
  if (!Array.isArray(players)) return null;
  if (lastAggressorIdx === null || typeof lastAggressorIdx === "undefined") {
    return null;
  }
  const agg = players[lastAggressorIdx];
  if (!agg) return null;
  if (isFoldedOrOut(agg) || agg.allIn) {
    const next = nextAliveFrom(players, lastAggressorIdx);
    if (next === null) return null;
    return next;
  }
  return lastAggressorIdx;
}

export function analyzeBetSnapshot({
  players = [],
  actedIndex = 0,
  dealerIdx = 0,
  drawRound = 0,
  numPlayers = players.length || 6,
  betHead = null,
  lastAggressorIdx = null,
}) {
  const snap = players.map((p) => ({ ...p }));
  const maxNow = maxBetThisRound(snap);
  const active = snap.filter((p) => !isFoldedOrOut(p));
  const everyoneMatched = active.every(
    (p) => p.allIn || (p.betThisRound || 0) === maxNow,
  );
  const allChecked =
    maxNow === 0 &&
    active.every((p) => isFoldedOrOut(p) || p.allIn || p.lastAction === "Check");
  const betRoundSatisfied = isBetRoundComplete(snap);
  const searchStart = typeof actedIndex === "number" ? actedIndex + 1 : 0;

  // Debug: snapshot of players prior to selecting nextTurn
  console.log("[BET][PLAYERS]", {
    actedIndex,
    maxNow,
    players: snap.map((p, idx) => ({
      idx,
      name: p.name,
      folded: p.folded,
      allIn: p.allIn,
      betThisRound: p.betThisRound,
      bet: p.bet,
      lastAction: p.lastAction,
      hasActedThisRound: p.hasActedThisRound,
    })),
  });

  const nextTurn = findNextBetActorSeat(snap, searchStart, maxNow);
  const closingSeatCandidate = closingSeatForAggressor(snap, lastAggressorIdx);
  const fallbackSeat = typeof betHead === "number" ? betHead : null;
  const closingSeat = closingSeatCandidate ?? fallbackSeat;
  const returnedToAggressor =
    typeof closingSeat === "number" && nextTurn === closingSeat;

  const bbIndex = (dealerIdx + 2) % (numPlayers || snap.length || 1);
  const bbSeat = snap[bbIndex];
  let isBBActed = true;
  if (drawRound === 0 && bbSeat) {
    const acted = ["Bet", "Call", "Raise", "Check"].includes(bbSeat.lastAction);
    isBBActed = bbSeat.folded || bbSeat.allIn || acted;
  }

  const isHeadsUp = active.length <= 2;
  let shouldAdvance = betRoundSatisfied && returnedToAggressor;

  if (!shouldAdvance) {
    if (maxNow > 0) {
      shouldAdvance = everyoneMatched && isBBActed;
    } else if (isHeadsUp) {
      const bothActed = active.every((p) => !!p.lastAction);
      shouldAdvance = bothActed;
    } else {
      shouldAdvance = allChecked;
    }
  }

  if (!shouldAdvance && nextTurn === null) {
    // Nothing left to act -> advance
    shouldAdvance = true;
  }

  return {
    playersSnapshot: snap,
    nextTurn,
    maxBet: maxNow,
    everyoneMatched,
    allChecked,
    betRoundSatisfied,
    closingSeat,
    returnedToAggressor,
    shouldAdvance,
    isHeadsUp,
    isBBActed,
  };
}

function findNextBetActorSeat(snapshotOrPlayers, startIdx = 0, maxBet = 0) {
  // snapshot でも players 配列でも動くようにする
  const players = Array.isArray(snapshotOrPlayers)
    ? snapshotOrPlayers
    : snapshotOrPlayers && Array.isArray(snapshotOrPlayers.players)
    ? snapshotOrPlayers.players
    : [];

  if (players.length === 0) return null;

  const n = players.length;
  const normalizedStart = ((startIdx % n) + n) % n;

  for (let offset = 0; offset < n; offset += 1) {
    const seat = (normalizedStart + offset) % n;
    const player = players[seat];
    if (!player || isFoldedOrOut(player) || player.allIn) continue;

    // betThisRound が無ければ bet を見る
    const bet =
      typeof player.betThisRound === "number"
        ? player.betThisRound
        : typeof player.bet === "number"
        ? player.bet
        : 0;

    // hasActedThisRound が無ければ lastAction/lastAct から推測
    const hasActed =
      typeof player.hasActedThisRound === "boolean"
        ? player.hasActedThisRound
        : Boolean(player.lastAction || player.lastAct);

    console.log("[BET][CANDIDATE]", {
      seat,
      name: player.name,
      bet,
      maxBet,
      hasActed,
      folded: player.folded,
      allIn: player.allIn,
      eligible: maxBet > 0 ? bet < maxBet : !hasActed,
    });

    if (maxBet > 0) {
      // まだ maxBet に届いてないプレイヤーだけがアクション対象
      if (bet < maxBet) {
        return seat;
      }
    } else if (!hasActed) {
      // オープニングラウンドで誰もベットしていない場合など
      return seat;
    }
  }

  return null;
}
