import { applyChips } from "../../core/applyChips.js";
import { normalizeBetActionAmount } from "../logic/actionAmount.js";

export { applyChips };

export function isFoldedOrOut(player) {
  return Boolean(player?.folded || player?.hasFolded || player?.seatOut);
}

// NOTE (H-01-2):
//   - BTN/SB/BB candidates must satisfy isPlayerSeated && isPlayerActiveInGame.
//   - BET actors use isSeatEligibleForBet, which adds !folded && !allIn.
//   - DRAW actors use isSeatEligibleForDraw. All-in seats still draw in draw
//     poker while they remain active in the current hand.
//   - Showdown contenders are filtered by isPlayerActiveInGame && !folded.
// All seat-selection helpers (nextAliveFrom, assignBlinds, controller actor search,
// and showdown code) MUST call these helpers instead of duplicating predicates.
export function isPlayerSeated(player) {
  if (!player) return false;
  if (player.seatOut || player.isBusted) return false;
  if (player.seatType && typeof player.seatType === "string") {
    if (player.seatType.toUpperCase() === "EMPTY") return false;
  }
  if (typeof player.stack === "number" && player.stack <= 0 && !player.allIn) return false;
  if (typeof player.isSeated === "boolean") return player.isSeated;
  return !player.seatOut;
}

export function isPlayerActiveInGame(player) {
  if (!player) return false;
  if (player.seatOut || player.isBusted) return false;
  if (typeof player.stack === "number" && player.stack <= 0 && !player.allIn) return false;
  if (typeof player.isActiveInGame === "boolean") return player.isActiveInGame;
  return true;
}

export function isPlayerEligibleForBlinds(player) {
  return isPlayerSeated(player) && isPlayerActiveInGame(player);
}

export function aliveBetPlayers(arr) {
  return Array.isArray(arr) ? arr.filter((p) => isSeatEligibleForBet(p)) : [];
}

export function aliveDrawPlayers(arr) {
  return Array.isArray(arr) ? arr.filter((p) => isSeatEligibleForDraw(p)) : [];
}

export function nextAliveFrom(arr, idx) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const n = arr.length;
  let next = ((idx ?? 0) + 1) % n;
  let loop = 0;
  while (!isSeatEligibleForBet(arr[next])) {
    next = (next + 1) % n;
    if (++loop > n) return null;
  }
  return next;
}

export function maxBetThisRound(arr) {
  if (!Array.isArray(arr)) return 0;
  const eligible = arr.filter((p) => !isFoldedOrOut(p));
  if (!eligible.length) return 0;
  return Math.max(...eligible.map((p) => p?.betThisRound || 0));
}

export function findNextActiveSeat(players, startIdx = 0) {
  if (!Array.isArray(players) || players.length === 0) return null;
  const n = players.length;
  for (let offset = 0; offset < n; offset += 1) {
    const candidate = (startIdx + offset) % n;
    const player = players[candidate];
    if (isSeatEligibleForBet(player)) {
      return candidate;
    }
  }
  return null;
}

export function firstBetterAfterBlinds(players, dealerIdx = 0) {
  if (!Array.isArray(players) || players.length === 0) return 0;
  const n = players.length;
  const blindSeats = getBlindSeatsForPlayers(players, dealerIdx);
  const start =
    typeof blindSeats.bbIdx === "number"
      ? (blindSeats.bbIdx + 1) % n
      : ((dealerIdx + 1) % n + n) % n;
  for (let offset = 0; offset < n; offset += 1) {
    const seat = (start + offset) % n;
    const player = players[seat];
    if (isSeatEligibleForBet(player)) {
      return seat;
    }
  }
  return start;
}

export function getBlindSeatsForPlayers(players = [], dealerIdx = 0) {
  if (!Array.isArray(players) || players.length === 0) {
    return { sbIdx: null, bbIdx: null };
  }
  const eligibleCount = players.reduce(
    (count, player) => count + (isPlayerEligibleForBlinds(player) ? 1 : 0),
    0,
  );
  if (eligibleCount < 2) {
    return { sbIdx: null, bbIdx: null };
  }
  const firstAfter = (fromSeat) => {
    const n = players.length;
    let cursor = typeof fromSeat === "number" ? fromSeat : 0;
    for (let offset = 0; offset < n; offset += 1) {
      cursor = (cursor + 1) % n;
      if (isPlayerEligibleForBlinds(players[cursor])) return cursor;
    }
    return null;
  };
  let sbIdx;
  if (eligibleCount === 2) {
    sbIdx = isPlayerEligibleForBlinds(players[dealerIdx]) ? dealerIdx : firstAfter(dealerIdx);
  } else {
    sbIdx = firstAfter(dealerIdx);
  }
  const bbIdx = typeof sbIdx === "number" ? firstAfter(sbIdx) : null;
  return { sbIdx, bbIdx };
}

export function sanitizeStacks(players) {
  if (!Array.isArray(players)) return [];
  return players.map((player) => {
    if (!player) return player;
    const next = { ...player };
    if (next.stack <= 0 && !next.allIn) {
      const label = next.name || `seat-${next.seat ?? "?"}`;
      console.warn(`[SANITIZE] ${label} stack=${next.stack} -> force all-in`);
      next.stack = 0;
      next.allIn = true;
    } else if (next.stack <= 0 && next.seatOut && next.isBusted !== true) {
      next.isBusted = true;
      next.hasActedThisRound = true;
    } else if (next.stack > 0 && next.isBusted) {
      next.isBusted = false;
    }
    return next;
  });
}

export function isPlayerInBetRound(player) {
  if (!isPlayerEligibleForBlinds(player)) return false;
  if (isFoldedOrOut(player)) return false;
  if (player?.allIn) return false;
  return true;
}

export function isSeatEligibleForBet(player) {
  return isPlayerInBetRound(player);
}

export function isSeatEligibleForDraw(player) {
  if (!isPlayerEligibleForBlinds(player)) return false;
  if (isFoldedOrOut(player)) return false;
  if (player?.canDraw === false) return false;
  return true;
}

// NOTE (G-07): Draw actor search mirrors BET actor search.
// We rely on isSeatEligibleForDraw (folded/busted/seatOut are skipped) and
// hasActedThisRound to decide who still needs to draw. Returning null means
// the draw round is complete and callers must advance the phase safely.
export function findNextDrawActorSeat(players = [], startIdx = 0) {
  if (!Array.isArray(players) || players.length === 0) return null;
  const n = players.length;
  const normalized =
    typeof startIdx === "number" && Number.isFinite(startIdx)
      ? ((Math.trunc(startIdx) % n) + n) % n
      : 0;
  for (let offset = 0; offset < n; offset += 1) {
    const seat = (normalized + offset) % n;
    const player = players[seat];
    if (isSeatEligibleForDraw(player) && !player?.hasActedThisRound) {
      return seat;
    }
  }
  return null;
}

// NOTE (G-06): Folded players must be completely skipped for BET/DRAW/showdown logic.
export function markPlayerFolded(player) {
  if (!player) return player;
  player.folded = true;
  player.hasFolded = true;
  player.hasActedThisRound = true;
  return player;
}

export function queueForcedSeatAction(map, seat, payload = {}) {
  if (typeof seat !== "number") return map ?? new Map();
  const next = new Map(map ?? []);
  next.set(seat, { ...payload });
  return next;
}

export function forceSequentialFolds(map, seats = []) {
  const list = Array.isArray(seats) ? seats : [seats];
  return list.reduce(
    (acc, seat) => queueForcedSeatAction(acc, seat, { type: "fold", __forceInstant: true }),
    map ?? new Map(),
  );
}

export function forceAllInAction(map, seat, amount) {
  if (typeof seat !== "number") return map ?? new Map();
  return queueForcedSeatAction(map ?? new Map(), seat, {
    type: "all-in",
    amount,
    __forceInstant: true,
  });
}

function clonePlayers(players) {
  return Array.isArray(players)
    ? players.map((player) => (player ? { ...player } : player))
    : [];
}

export function applyForcedBetActionSnapshot({ players, seat, payload = {}, betSize }) {
  if (!Array.isArray(players) || typeof seat !== "number" || seat < 0 || seat >= players.length) {
    return { success: false };
  }

  const snap = clonePlayers(players);
  const actor = snap[seat];
  if (!actor || isFoldedOrOut(actor)) {
    return { success: false };
  }

  const stackBefore = Math.max(0, Number(actor.stack) || 0);
  const betBefore = Math.max(0, Number(actor.betThisRound) || 0);
  const totalInvestedBefore = Math.max(0, Number(actor.totalInvested) || 0);
  actor.stack = stackBefore;
  actor.betThisRound = betBefore;
  actor.totalInvested = totalInvestedBefore;
  const maxNow = maxBetThisRound(snap);
  const toCall = Math.max(0, maxNow - betBefore);
  let actionType = (payload.type || "call").toLowerCase();
  const unit = Math.max(1, Number(betSize) || 1);
  let raiseApplied = false;
  let actionContribution = 0;

  const invest = (chips) => {
    if (chips <= 0) return 0;
    const applied = applyChips(actor, chips);
    actor.betThisRound += applied;
    actionContribution += applied;
    const expectedTotalInvested = totalInvestedBefore + actionContribution;
    actor.totalInvested = Math.max(actor.totalInvested ?? 0, expectedTotalInvested);
    if (actor.stack === 0) {
      actor.allIn = true;
      actor.hasActedThisRound = true;
    }
    return applied;
  };

  switch (actionType) {
    case "fold":
      markPlayerFolded(actor);
      actor.lastAction = "Fold";
      break;
    case "check":
      actor.lastAction = "Check";
      actor.hasActedThisRound = true;
      break;
    case "call": {
      const amountModel = normalizeBetActionAmount({
        actionType: "CALL",
        amount: payload.amount,
        toCall,
        unit,
      });
      const requested = amountModel.isValid
        ? amountModel.contribution
        : toCall;
      const paid = invest(Math.max(0, requested));
      actor.lastAction = paid === 0 ? "Check" : "Call";
      actor.hasActedThisRound = true;
      break;
    }
    case "bet":
    case "raise": {
      const amountModel = normalizeBetActionAmount({
        actionType: "RAISE",
        amount: payload.amount,
        toCall,
        unit,
      });
      const requested = amountModel.isValid
        ? amountModel.contribution
        : Math.max(0, toCall + unit);
      const paidRaise = invest(requested);
      const fullRaiseBet = maxNow + unit;
      const isFullFixedLimitRaise = actor.betThisRound >= fullRaiseBet;
      const isOpeningAllIn = maxNow === 0 && paidRaise > 0 && actor.betThisRound < unit;
      actor.lastAction = isFullFixedLimitRaise
        ? "Raise"
        : isOpeningAllIn
        ? "All-in"
        : paidRaise > 0
        ? "Call"
        : "Check";
      actor.hasActedThisRound = true;
      raiseApplied = isFullFixedLimitRaise;
      break;
    }
    case "all-in": {
      invest(toCall);
      const shoveTarget =
        payload.amount == null ? actor.stack : Math.max(0, payload.amount);
      invest(shoveTarget);
      const fullRaiseBet = maxNow + unit;
      raiseApplied = actor.betThisRound >= fullRaiseBet;
      actor.lastAction = "All-in";
      actor.hasActedThisRound = true;
      break;
    }
    default:
      console.warn("[E2E] Unknown forced action type:", payload.type);
      return { success: false };
  }

  snap[seat] = actor;
  if (raiseApplied) {
    for (let i = 0; i < snap.length; i += 1) {
      if (i === seat) continue;
      const player = snap[i];
      if (!player || isFoldedOrOut(player) || player.allIn) continue;
      player.hasActedThisRound = false;
    }
  }
  return {
    success: true,
    updatedPlayers: snap,
    actor,
    actionLabel: actor.lastAction || actionType.toUpperCase(),
    raiseApplied,
    stackBefore,
    stackAfter: actor.stack,
    betBefore,
    betAfter: actor.betThisRound,
  };
}
