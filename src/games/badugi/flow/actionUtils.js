export function isFoldedOrOut(player) {
  return Boolean(player?.folded || player?.hasFolded || player?.seatOut);
}

export function aliveBetPlayers(arr) {
  return Array.isArray(arr)
    ? arr.filter((p) => !isFoldedOrOut(p) && !p?.allIn)
    : [];
}

export function aliveDrawPlayers(arr) {
  return Array.isArray(arr) ? arr.filter((p) => !isFoldedOrOut(p)) : [];
}

export function nextAliveFrom(arr, idx) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const n = arr.length;
  let next = ((idx ?? 0) + 1) % n;
  let loop = 0;
  while (isFoldedOrOut(arr[next]) || arr[next]?.allIn) {
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
    if (player && !isFoldedOrOut(player) && !player.allIn) {
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
    if (player && !isFoldedOrOut(player) && !player.allIn) {
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
    const applied = Math.min(actor.stack, chips);
    actor.stack -= applied;
    actor.betThisRound += applied;
    if (applied > 0) {
      actor.totalInvested = (actor.totalInvested ?? 0) + applied;
    }
    if (actor.stack === 0) {
      actor.allIn = true;
      actor.hasActedThisRound = true;
    }
    return applied;
  };

  switch (actionType) {
    case "fold":
      actor.folded = true;
      actor.hasFolded = true;
      actor.lastAction = "Fold";
      actor.hasActedThisRound = true;
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
