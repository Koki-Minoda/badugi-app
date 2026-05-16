function toIndex(value) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function betOf(player = {}) {
  return Number(player.betThisStreet ?? player.betThisRound ?? player.bet ?? player.committed ?? 0) || 0;
}

function stackOf(player = {}) {
  return Number(player.stack ?? player.chips ?? 0) || 0;
}

function hasStackValue(player = {}) {
  return typeof player.stack === "number" || typeof player.chips === "number";
}

function currentBetOf(state = {}) {
  if (Number.isFinite(Number(state.currentBet))) return Number(state.currentBet);
  if (Number.isFinite(Number(state.metadata?.currentBet))) return Number(state.metadata.currentBet);
  const players = Array.isArray(state.players) ? state.players : [];
  return players.reduce((max, player) => Math.max(max, betOf(player)), 0);
}

function isFolded(player = {}) {
  return Boolean(player.folded || player.hasFolded || String(player.status ?? "").toUpperCase() === "FOLDED");
}

function isSeatOut(player = {}) {
  const status = String(player.status ?? "").toUpperCase();
  return Boolean(
    player.seatOut ||
      player.sittingOut ||
      player.isSittingOut ||
      player.eliminated ||
      player.isEliminated ||
      player.isBusted ||
      player.busted ||
      player.seatType === "EMPTY" ||
      status === "BUSTED" ||
      status === "OUT",
  );
}

function isAllIn(player = {}) {
  return Boolean(player.allIn || player.isAllIn || String(player.status ?? "").toUpperCase() === "ALL-IN");
}

function normalizedActionName(action) {
  return String(action ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function hasActedForBetting(player = {}) {
  if (typeof player.hasActedThisRound === "boolean") return player.hasActedThisRound;
  if (typeof player.actedThisRound === "boolean") return player.actedThisRound;
  const action = normalizedActionName(player.lastAction ?? player.lastAct);
  return ["CHECK", "CALL", "BET", "RAISE", "FOLD", "ALL_IN"].includes(action);
}

function hasDrawn(player = {}) {
  return Boolean(player.hasDrawn || player.hasDrawnThisRound || player.drawnThisRound);
}

function legalActionTypes(player = {}) {
  const legal = player.legalActions;
  if (!Array.isArray(legal)) return null;
  return new Set(legal.map((action) => String(action?.type ?? action?.action ?? action ?? "").toUpperCase()));
}

const TERMINAL_PHASES = new Set([
  "SHOWDOWN",
  "HAND_RESULT",
  "WAITING_NEXT_HAND",
  "COMPLETE",
  "TERMINAL",
]);

export function getAuthoritativeActorIndex(state = {}) {
  const actor =
    toIndex(state.currentActor) ??
    toIndex(state.actingPlayerIndex) ??
    toIndex(state.turn) ??
    toIndex(state.nextTurn);
  return actor;
}

export function isSeatActiveForHand(player) {
  if (!player) return false;
  if (isFolded(player)) return false;
  if (isSeatOut(player)) return false;
  if (hasStackValue(player) && stackOf(player) <= 0 && !isAllIn(player)) return false;
  return true;
}

export function isSeatEligibleForBetting(player, state = {}, options = {}) {
  if (!isSeatActiveForHand(player)) return false;
  if (isAllIn(player)) return false;
  if (hasStackValue(player) && stackOf(player) <= 0) return false;

  const legalTypes = legalActionTypes(player);
  if (legalTypes && !["CHECK", "CALL", "BET", "RAISE", "FOLD"].some((type) => legalTypes.has(type))) {
    return false;
  }

  if (options.ignoreActionCompletion) return true;

  const currentBet = currentBetOf(state);
  const playerBet = betOf(player);
  return playerBet < currentBet || !hasActedForBetting(player);
}

export function isSeatEligibleForDrawing(player, state = {}, options = {}) {
  if (!isSeatActiveForHand(player)) return false;
  if (isAllIn(player) && !options.allowAllInDraw) return false;
  if (hasDrawn(player)) return false;
  if (player.hasActedThisRound && String(state.phase ?? "").toUpperCase() === "DRAW") return false;

  const pending = Array.isArray(state.pendingDrawSeats) ? state.pendingDrawSeats.map(Number) : null;
  const seatIndex = toIndex(player.seatIndex);
  if (pending?.length && seatIndex != null && !pending.includes(seatIndex)) return false;
  return true;
}

export function getEligibleActorSeats(state = {}, options = {}) {
  const phase = String(options.phase ?? state.phase ?? state.street ?? "BET").toUpperCase();
  const players = Array.isArray(state.players) ? state.players : [];
  return players
    .map((player, fallbackIndex) => ({ player: { seatIndex: fallbackIndex, ...player }, seatIndex: toIndex(player?.seatIndex) ?? fallbackIndex }))
    .filter(({ player }) =>
      phase === "DRAW"
        ? isSeatEligibleForDrawing(player, state, options)
        : isSeatEligibleForBetting(player, state, options),
    )
    .map(({ seatIndex }) => seatIndex);
}

export function findNextEligibleActor(state = {}, options = {}) {
  const players = Array.isArray(state.players) ? state.players : [];
  if (!players.length) return null;
  const startIndex = toIndex(options.startIndex) ?? 0;
  const phase = String(options.phase ?? state.phase ?? state.street ?? "BET").toUpperCase();

  for (let offset = 0; offset < players.length; offset += 1) {
    const seatIndex = (startIndex + offset) % players.length;
    const player = { seatIndex, ...players[seatIndex] };
    const eligible =
      phase === "DRAW"
        ? isSeatEligibleForDrawing(player, state, options)
        : isSeatEligibleForBetting(player, state, options);
    if (eligible) return seatIndex;
  }
  return null;
}

export function normalizeTurnState(state = {}, options = {}) {
  const phase = String(options.phase ?? state.phase ?? state.street ?? "BET").toUpperCase();
  const players = Array.isArray(state.players) ? state.players : [];
  if (TERMINAL_PHASES.has(phase) || state.lastHandResult) {
    return {
      ...state,
      currentActor: null,
      actingPlayerIndex: null,
      turn: null,
      nextTurn: null,
      players: players.map((player) => ({
        ...player,
        isTurn: false,
      })),
    };
  }
  const preferredActor = toIndex(options.actor) ?? getAuthoritativeActorIndex(state);
  const actorIsEligible =
    preferredActor != null &&
    players[preferredActor] &&
    (phase === "DRAW"
      ? isSeatEligibleForDrawing({ seatIndex: preferredActor, ...players[preferredActor] }, state, options)
      : isSeatEligibleForBetting(
          { seatIndex: preferredActor, ...players[preferredActor] },
          state,
          { ...options, ignoreActionCompletion: true },
        ));
  const actor = actorIsEligible
    ? preferredActor
    : findNextEligibleActor(state, { ...options, phase, startIndex: preferredActor ?? 0 });

  return {
    ...state,
    currentActor: actor,
    actingPlayerIndex: actor,
    turn: actor,
    nextTurn: actor,
    players: players.map((player, seatIndex) => ({
      ...player,
      isTurn: actor === seatIndex,
    })),
  };
}
