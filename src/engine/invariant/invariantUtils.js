export const TERMINAL_PHASES = new Set([
  "SHOWDOWN",
  "HAND_RESULT",
  "WAITING_NEXT_HAND",
  "COMPLETE",
  "FINISHED",
  "TERMINAL",
]);

export function makeViolation(type, message, context = {}) {
  return {
    type,
    message,
    variantId: context.variantId ?? context.snapshot?.variantId ?? context.snapshot?.gameVariant ?? null,
    mode: context.mode ?? context.snapshot?.mode ?? null,
    handId: context.handId ?? context.snapshot?.handId ?? null,
    phase: getPhase(context.snapshot),
    actor: getActor(context.snapshot),
    severity: context.severity ?? "P0",
  };
}

export function getPhase(snapshot = {}) {
  return String(snapshot?.phase ?? snapshot?.street ?? "").toUpperCase();
}

export function getPlayers(snapshot = {}) {
  return Array.isArray(snapshot?.players) ? snapshot.players : [];
}

export function getActor(snapshot = {}) {
  const metadataActor = snapshot?.metadata?.actingPlayerIndex;
  const candidates = [
    snapshot?.currentActor,
    snapshot?.actor,
    snapshot?.turn,
    snapshot?.nextTurn,
    metadataActor,
  ];
  for (const candidate of candidates) {
    if (Number.isInteger(candidate) && candidate >= 0) return candidate;
  }
  return null;
}

export function isTerminal(snapshot = {}) {
  const phase = getPhase(snapshot);
  return Boolean(
    snapshot?.isTerminal ||
      snapshot?.isFinished ||
      snapshot?.lastHandResult ||
      snapshot?.winner ||
      TERMINAL_PHASES.has(phase),
  );
}

export function isFolded(player = {}) {
  return Boolean(player?.folded || player?.hasFolded);
}

export function isSeatOut(player = {}) {
  return Boolean(player?.seatOut || player?.isBusted || player?.busted || player?.sittingOut);
}

export function isAllIn(player = {}) {
  return Boolean(player?.allIn || player?.isAllIn);
}

export function contributionOf(player = {}) {
  return Math.max(
    0,
    Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? player?.committed ?? 0) || 0,
  );
}

export function stackOf(player = {}) {
  return Number(player?.stack ?? player?.chips ?? 0) || 0;
}

export function getCurrentBet(snapshot = {}) {
  const players = getPlayers(snapshot);
  return Math.max(
    0,
    Number(snapshot?.currentBet ?? snapshot?.betToCall ?? 0) || 0,
    ...players.map((player) => contributionOf(player)),
  );
}

export function getPotAmount(snapshot = {}) {
  if (typeof snapshot?.pot === "number") return Math.max(0, snapshot.pot);
  if (typeof snapshot?.potTotal === "number") return Math.max(0, snapshot.potTotal);
  if (Array.isArray(snapshot?.pots)) {
    return snapshot.pots.reduce(
      (sum, pot) => sum + Math.max(0, Number(pot?.amount ?? pot?.potAmount) || 0),
      0,
    );
  }
  return 0;
}

export function activeSeats(players = []) {
  return players.flatMap((player, seat) =>
    player && !isFolded(player) && !isSeatOut(player) ? [seat] : [],
  );
}

export function eligibleBetSeats(snapshot = {}) {
  const currentBet = getCurrentBet(snapshot);
  return getPlayers(snapshot).flatMap((player, seat) => {
    if (!player || isFolded(player) || isSeatOut(player) || isAllIn(player)) return [];
    const contribution = contributionOf(player);
    const hasActed = Boolean(player.hasActedThisRound || player.hasActedThisStreet);
    if (contribution < currentBet) return [seat];
    if (currentBet <= 0 && !hasActed) return [seat];
    return [];
  });
}

export function drawRoundOf(snapshot = {}) {
  const value = Number(snapshot?.drawRoundIndex ?? snapshot?.drawRound ?? snapshot?.metadata?.drawRoundIndex ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function streetKeyFromSnapshot(snapshot = {}) {
  return [
    snapshot?.handId ?? "unknown",
    getPhase(snapshot) || "UNKNOWN",
    drawRoundOf(snapshot),
    snapshot?.betRound ?? snapshot?.betRoundIndex ?? "",
  ].join(":");
}

