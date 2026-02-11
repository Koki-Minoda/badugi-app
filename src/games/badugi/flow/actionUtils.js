import { applyChips } from "../../core/applyChips.js";

export { applyChips };

export function isFoldedOrOut(player) {
  return Boolean(player?.folded || player?.hasFolded || player?.seatOut);
}

// NOTE (H-01-2):
//   - BTN/SB/BB candidates must satisfy isPlayerSeated && isPlayerActiveInGame.
//   - BET/DRAW actors use isSeatEligibleForBet / isSeatEligibleForDraw,
//     which add !folded && !allIn on top of the above conditions.
//   - Showdown contenders are filtered by isPlayerActiveInGame && !folded.
// All seat-selection helpers (nextAliveFrom, assignBlinds, controller actor search,
// and showdown code) MUST call these helpers instead of duplicating predicates.
export function isPlayerSeated(player) {
  if (!player) return false;
  if (typeof player.isSeated === "boolean") return player.isSeated;
  if (player.seatType && typeof player.seatType === "string") {
    if (player.seatType.toUpperCase() === "EMPTY") return false;
  }
  return !player.seatOut;
}

export function isPlayerActiveInGame(player) {
  if (!player) return false;
  if (typeof player.isActiveInGame === "boolean") return player.isActiveInGame;
  if (player.seatOut || player.isBusted) return false;
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
  const start = ((dealerIdx + 3) % n + n) % n;
  for (let offset = 0; offset < n; offset += 1) {
    const seat = (start + offset) % n;
    const player = players[seat];
    if (isSeatEligibleForBet(player)) {
      return seat;
    }
  }
  return start;
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
      next.hasDrawn = true;
      next.isBusted = true;
      next.hasActedThisRound = true;
    } else if (next.stack <= 0 && next.isBusted !== true) {
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
// We rely on isSeatEligibleForDraw (folded/all-in are skipped) and
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

  const stackBefore = actor.stack;
  const betBefore = actor.betThisRound;
  const maxNow = maxBetThisRound(snap);
  const toCall = Math.max(0, maxNow - actor.betThisRound);
  let actionType = (payload.type || "call").toLowerCase();
  let raiseSize = Number.isFinite(payload.amount) ? Math.max(0, payload.amount) : betSize;
  let raiseApplied = false;

  const invest = (chips) => {
    if (chips <= 0) return 0;
    const applied = applyChips(actor, chips);
    actor.betThisRound += applied;
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
      if (toCall > 0) {
        actionType = "call";
      } else {
        actor.lastAction = "Check";
        actor.hasActedThisRound = true;
        break;
      }
    // eslint-disable-next-line no-fallthrough
    case "call": {
      const paid = invest(toCall);
      actor.lastAction = paid === 0 ? "Check" : "Call";
      actor.hasActedThisRound = true;
      break;
    }
    case "bet":
    case "raise": {
      invest(toCall);
      const paidRaise = invest(Math.max(raiseSize, betSize));
      actor.lastAction = "Raise";
      actor.hasActedThisRound = true;
      raiseApplied = paidRaise > 0;
      break;
    }
    case "all-in": {
      invest(toCall);
      const shoveTarget =
        payload.amount == null ? actor.stack : Math.max(0, payload.amount);
      const paid = invest(shoveTarget);
      actor.lastAction = "All-in";
      actor.hasActedThisRound = true;
      raiseApplied = paid > 0;
      break;
    }
    default:
      console.warn("[E2E] Unknown forced action type:", payload.type);
      return { success: false };
  }

  snap[seat] = actor;
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
