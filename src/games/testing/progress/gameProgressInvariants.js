import {
  getAuthoritativeActorIndex,
  getEligibleActorSeats,
} from "../../core/turn/actorEligibility.js";

function fail(message, context = {}) {
  const details = {
    variantId: context.variantId ?? context.snapshot?.variantId ?? context.snapshot?.variant ?? "unknown",
    seed: context.seed ?? "unknown",
    step: context.step ?? "unknown",
    phase: context.phase ?? context.snapshot?.phase ?? context.snapshot?.street ?? "unknown",
    actor: context.actor ?? getActorIndex(context.snapshot),
    scenario: context.scenarioId ?? context.scenario ?? "unknown",
    message,
  };
  throw new Error(`[MGX_PROGRESS_INVARIANT] ${message} ${JSON.stringify(details)}`);
}

export function getActorIndex(snapshot = {}) {
  return getAuthoritativeActorIndex(snapshot);
}

function getPhase(snapshot = {}) {
  return String(snapshot?.phase ?? snapshot?.street ?? "").toUpperCase();
}

function getPlayers(snapshot = {}) {
  return Array.isArray(snapshot?.players) ? snapshot.players : [];
}

function isTerminal(snapshot = {}) {
  const phase = getPhase(snapshot);
  return Boolean(
    snapshot?.isTerminal ||
      snapshot?.isFinished ||
      snapshot?.winner ||
      snapshot?.lastHandResult ||
      phase === "SHOWDOWN" ||
      phase === "HAND_RESULT" ||
      phase === "FINISHED",
  );
}

function isFolded(player = {}) {
  return Boolean(player.folded || player.hasFolded);
}

function isBusted(player = {}) {
  return Boolean(
    player.isBusted ||
      player.busted ||
      player.seatOut ||
      player.sittingOut ||
      (Math.max(0, Number(player.stack) || 0) <= 0 && !player.allIn),
  );
}

function canBetAct(player = {}) {
  return Boolean(player && !isFolded(player) && !isBusted(player) && !player.allIn);
}

function canDrawAct(player = {}) {
  return Boolean(player && !isFolded(player) && !isBusted(player) && !player.hasDrawn);
}

function getPotAmount(snapshot = {}) {
  if (typeof snapshot?.pot === "number") return snapshot.pot;
  if (Array.isArray(snapshot?.pots)) {
    return snapshot.pots.reduce(
      (sum, pot) => sum + Math.max(0, Number(pot?.amount ?? pot?.potAmount) || 0),
      0,
    );
  }
  return 0;
}

function getDrawRoundIndex(snapshot = {}) {
  const value = Number(snapshot?.drawRoundIndex ?? snapshot?.drawRound ?? snapshot?.metadata?.drawRoundIndex ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function validateDiscardIndexes({ discardIndexes, handSize, maxDiscardCount, context, snapshot, seatIndex }) {
  if (!Array.isArray(discardIndexes)) return;
  const normalized = discardIndexes.map(Number);
  if (normalized.some((idx) => !Number.isInteger(idx))) {
    fail("discardIndexes contains a non-integer index", { ...context, snapshot, actor: seatIndex });
  }
  if (new Set(normalized).size !== normalized.length) {
    fail("discardIndexes contains duplicate indexes", { ...context, snapshot, actor: seatIndex });
  }
  normalized.forEach((idx) => {
    if (idx < 0 || (handSize > 0 && idx >= handSize)) {
      fail("discardIndexes contains out-of-range index", { ...context, snapshot, actor: seatIndex });
    }
  });
  if (normalized.length > maxDiscardCount) {
    fail("discardIndexes exceeds max discard count", { ...context, snapshot, actor: seatIndex });
  }
}

export function assertTurnInvariants(snapshot, context = {}) {
  const players = getPlayers(snapshot);
  const actor = getActorIndex(snapshot);
  const phase = getPhase(snapshot);
  const terminal = isTerminal(snapshot);
  const turnFlags = players
    .map((player, seatIndex) => (player?.isTurn ? seatIndex : null))
    .filter((seatIndex) => seatIndex != null);

  if (turnFlags.length > 1) {
    fail("multiple players have isTurn=true", { ...context, snapshot, actor, phase });
  }
  if (turnFlags.length === 1 && actor != null && turnFlags[0] !== actor) {
    fail("isTurn flag disagrees with authoritative actor", { ...context, snapshot, actor, phase });
  }

  const primaryFields = [
    ["currentActor", snapshot?.currentActor],
    ["actingPlayerIndex", snapshot?.actingPlayerIndex],
    ["turn", snapshot?.turn],
    ["nextTurn", snapshot?.nextTurn],
  ].filter(([, value]) => typeof value === "number");
  const uniquePrimaryActors = new Set(primaryFields.map(([, value]) => value));
  if (uniquePrimaryActors.size > 1) {
    fail("turn source fields disagree", { ...context, snapshot, actor, phase });
  }

  if (actor == null) {
    const eligible = ["BET", "DRAW"].includes(phase)
      ? getEligibleActorSeats(snapshot, {
          phase,
          allowAllInDraw: context.allowAllInDraw ?? true,
        }).length > 0
      : false;
    if (!terminal && eligible) {
      fail("eligible player exists but no actor is set", { ...context, snapshot, actor, phase });
    }
    return;
  }

  const player = players[actor];
  if (!player) {
    fail("turn actor does not exist", { ...context, snapshot, actor, phase });
  }
  if (isFolded(player)) {
    fail("folded player received turn", { ...context, snapshot, actor, phase });
  }
  if (isBusted(player)) {
    fail("busted/seat-out player received turn", { ...context, snapshot, actor, phase });
  }
  if (phase === "BET" && player.allIn) {
    fail("all-in player received betting turn", { ...context, snapshot, actor, phase });
  }
  if (phase === "BET" && !canBetAct(player)) {
    fail("non-eligible betting actor received turn", { ...context, snapshot, actor, phase });
  }
  if (
    phase === "DRAW" &&
    Array.isArray(snapshot?.pendingDrawSeats) &&
    snapshot.pendingDrawSeats.length > 0 &&
    !snapshot.pendingDrawSeats.map(Number).includes(actor)
  ) {
    fail("draw actor is not in pendingDrawSeats", { ...context, snapshot, actor, phase });
  }
  if (phase === "DRAW" && player.hasDrawn) {
    fail("already drawn player received draw turn", { ...context, snapshot, actor, phase });
  }
  if (phase === "DRAW" && !canDrawAct(player)) {
    fail("non-eligible draw actor received turn", { ...context, snapshot, actor, phase });
  }
}

export function assertBettingInvariants(snapshot, context = {}) {
  const players = getPlayers(snapshot);
  const pot = getPotAmount(snapshot);
  if (pot < 0) fail("pot is negative", { ...context, snapshot });
  players.forEach((player, seatIndex) => {
    const stack = Number(player?.stack ?? 0);
    const committed = Number(
      player?.totalInvested ?? player?.committed ?? player?.betThisStreet ?? player?.bet ?? 0,
    );
    const callAmount = Number(player?.callAmount ?? player?.toCall ?? 0);
    if (stack < 0) fail("stack is negative", { ...context, snapshot, actor: seatIndex });
    if (committed < 0) fail("committed amount is negative", { ...context, snapshot, actor: seatIndex });
    if (callAmount < 0) fail("call amount is negative", { ...context, snapshot, actor: seatIndex });
    if (player?.allIn && player?.legalActions?.some((action) => /call|raise|bet/i.test(action?.type ?? action))) {
      fail("all-in player exposes betting legal action", { ...context, snapshot, actor: seatIndex });
    }
  });
}

export function assertDrawInvariants(snapshot, context = {}) {
  const phase = getPhase(snapshot);
  const players = getPlayers(snapshot);
  const maxDrawRounds = Number(
    context.maxDrawRounds ?? snapshot?.maxDrawRounds ?? snapshot?.metadata?.maxDrawRounds ?? Infinity,
  );
  const drawRound = getDrawRoundIndex(snapshot);
  const previousDrawRound = context.previousSnapshot ? getDrawRoundIndex(context.previousSnapshot) : null;
  if (previousDrawRound != null && drawRound < previousDrawRound) {
    fail("draw round index decreased", { ...context, snapshot, phase });
  }
  if (Number.isFinite(maxDrawRounds) && drawRound > maxDrawRounds) {
    fail("draw round exceeds variant max draw count", { ...context, snapshot, phase });
  }
  const expectedHandSize = Number(
    context.handCardCount ?? snapshot?.handCardCount ?? snapshot?.metadata?.handCardCount ?? 0,
  );
  const shouldEnforceHandSize = phase === "DRAW" || context.enforceHandSize === true;
  const pendingDrawSeats = Array.isArray(snapshot?.pendingDrawSeats)
    ? snapshot.pendingDrawSeats.map(Number)
    : Array.isArray(snapshot?.metadata?.pendingDrawSeats)
      ? snapshot.metadata.pendingDrawSeats.map(Number)
      : [];
  pendingDrawSeats.forEach((seatIndex) => {
    const player = players[seatIndex];
    if (!player || isFolded(player) || isBusted(player)) {
      fail("pendingDrawSeats contains inactive seat", { ...context, snapshot, actor: seatIndex, phase });
    }
    if (player?.hasDrawn) {
      fail("pendingDrawSeats contains already drawn seat", { ...context, snapshot, actor: seatIndex, phase });
    }
  });
  players.forEach((player, seatIndex) => {
    const lastDrawCount = Number(player?.lastDrawCount ?? 0);
    const maxDiscardCount = Number(
      context.maxDiscardCount ?? snapshot?.maxDiscardCount ?? snapshot?.metadata?.maxDiscardCount ?? expectedHandSize,
    );
    if (lastDrawCount > maxDiscardCount) {
      fail("draw count exceeds max discard count", { ...context, snapshot, actor: seatIndex, phase });
    }
    validateDiscardIndexes({
      discardIndexes: player?.lastDiscardIndexes,
      handSize: Array.isArray(player?.hand) ? player.hand.length : expectedHandSize,
      maxDiscardCount,
      context,
      snapshot,
      seatIndex,
    });
    const hand = player?.hand ?? player?.holeCards ?? player?.cards ?? [];
    if (
      shouldEnforceHandSize &&
      expectedHandSize > 0 &&
      Array.isArray(hand) &&
      hand.length > 0 &&
      !isFolded(player) &&
      !isBusted(player) &&
      hand.length !== expectedHandSize
    ) {
      fail("hand size changed after draw", { ...context, snapshot, actor: seatIndex, phase });
    }
  });
  const lastDrawAction = snapshot?.metadata?.lastDrawAction ?? snapshot?.metadata?.lastDraw;
  if (lastDrawAction) {
    const beforeHand = lastDrawAction.beforeHand ?? lastDrawAction.before;
    const afterHand = lastDrawAction.afterHand ?? lastDrawAction.after;
    const actionSeat = lastDrawAction.seatIndex ?? lastDrawAction.seat;
    const actionHandSize = Array.isArray(beforeHand)
      ? beforeHand.length
      : expectedHandSize || (Array.isArray(afterHand) ? afterHand.length : 0);
    const maxDiscardCount = Number(
      context.maxDiscardCount ?? snapshot?.maxDiscardCount ?? snapshot?.metadata?.maxDiscardCount ?? actionHandSize,
    );
    validateDiscardIndexes({
      discardIndexes: lastDrawAction.discardIndexes ?? lastDrawAction.drawIndexes,
      handSize: actionHandSize,
      maxDiscardCount,
      context,
      snapshot,
      seatIndex: actionSeat,
    });
    const actionDrawCount = Number(lastDrawAction.drawCount ?? lastDrawAction.discardCount);
    const indexes = lastDrawAction.discardIndexes ?? lastDrawAction.drawIndexes;
    if (Array.isArray(indexes) && Number.isFinite(actionDrawCount) && actionDrawCount !== indexes.length) {
      fail("drawCount does not match discardIndexes length", { ...context, snapshot, actor: actionSeat, phase });
    }
    if (Array.isArray(beforeHand) && Array.isArray(afterHand) && beforeHand.length !== afterHand.length) {
      fail("draw beforeHand and afterHand sizes differ", { ...context, snapshot, actor: actionSeat, phase });
    }
  }
}

export function assertTournamentInvariants(snapshot, context = {}) {
  if (!context.isTournament && !snapshot?.isTournament && !snapshot?.tournament) return;
  const players = getPlayers(snapshot);
  const terminal = isTerminal(snapshot);
  const active = players.filter((player) => player && !isBusted(player));
  if (!terminal && players.length > 0 && active.length === 0) {
    fail("non-terminal tournament has no active players", { ...context, snapshot });
  }
  const ids = players
    .map((player, seatIndex) => player?.playerId ?? player?.tournamentPlayerId ?? player?.id ?? `seat-${seatIndex}`)
    .filter(Boolean);
  if (new Set(ids).size !== ids.length) {
    fail("duplicate playerId after reseat/table merge", { ...context, snapshot });
  }
  const winners = players.filter((player) => player?.winner || player?.isWinner);
  if (winners.length > 1) {
    fail("multiple tournament winners marked", { ...context, snapshot });
  }
}

export function assertGameProgressInvariants(snapshot, context = {}) {
  assertTurnInvariants(snapshot, context);
  assertBettingInvariants(snapshot, context);
  assertDrawInvariants(snapshot, context);
  assertTournamentInvariants(snapshot, context);
}
