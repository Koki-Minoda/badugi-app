function normalizePlayers(players = []) {
  return players.map((player, seat) => ({
    seat: typeof player?.seat === "number" ? player.seat : seat,
    folded: Boolean(player?.folded || player?.hasFolded),
    allIn: Boolean(player?.allIn),
    seatOut: Boolean(player?.seatOut || player?.isBusted || player?.isActiveInGame === false),
    bet: Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? player?.committedThisStreet ?? 0) || 0,
    acted: Boolean(player?.acted || player?.hasActedThisRound || player?.hasActedThisStreet),
    lastAction: player?.lastAction ?? null,
  }));
}

function isEligible(player) {
  return player && !player.folded && !player.allIn && !player.seatOut;
}

function nextSeatFrom(startSeat, players, excluded = new Set()) {
  if (!players.length || typeof startSeat !== "number") return null;
  for (let offset = 1; offset <= players.length; offset += 1) {
    const seat = (startSeat + offset) % players.length;
    if (excluded.has(seat)) continue;
    if (isEligible(players[seat])) return seat;
  }
  return null;
}

export function playersNeedingBrowserAction(playersInput = [], currentBet = 0) {
  const players = normalizePlayers(playersInput);
  return players
    .filter((player) => {
      if (!isEligible(player)) return false;
      if (!player.acted) return true;
      if (Number(player.bet) < Number(currentBet)) return true;
      return false;
    })
    .map((player) => player.seat);
}

export function expectedBrowserFirstActor({
  phase,
  drawRound,
  buttonSeat,
  bbSeat,
  players,
}) {
  const normalized = normalizePlayers(players);
  const active = normalized.filter(isEligible);
  if (active.length <= 1) return null;
  const isPreDrawBet = String(phase).toUpperCase() === "BET" && Number(drawRound ?? 0) === 0;
  if (active.length === 2 && isPreDrawBet) {
    return isEligible(normalized[buttonSeat]) ? buttonSeat : nextSeatFrom(buttonSeat, normalized);
  }
  const anchor = isPreDrawBet ? bbSeat : buttonSeat;
  return nextSeatFrom(anchor, normalized);
}

export function expectedBrowserActor({
  phase,
  drawRound,
  buttonSeat,
  bbSeat,
  players,
  currentBet = 0,
  actorSeat = null,
}) {
  const normalized = normalizePlayers(players);
  const phaseName = String(phase ?? "").toUpperCase();
  if (["HAND_RESULT", "SHOWDOWN", "WAITING_NEXT_HAND", "COMPLETE", "TERMINAL"].includes(phaseName)) {
    return { expectedActorSeat: null, playersNeedingAction: [], shouldRoundClose: true, expectedNextPhase: "TERMINAL" };
  }
  if (phaseName !== "BET") {
    return { expectedActorSeat: actorSeat, playersNeedingAction: [], shouldRoundClose: false, expectedNextPhase: null };
  }

  const livePlayers = normalized.filter((player) => player && !player.folded && !player.seatOut);
  if (livePlayers.length <= 1) {
    return { expectedActorSeat: null, playersNeedingAction: [], shouldRoundClose: true, expectedNextPhase: "TERMINAL" };
  }

  const playersNeedingAction = normalized
    .filter((player) => {
      if (!isEligible(player)) return false;
      if (!player.acted) return true;
      if (Number(player.bet) < Number(currentBet)) return true;
      return false;
    })
    .map((player) => player.seat);
  const shouldRoundClose = playersNeedingAction.length === 0;
  if (shouldRoundClose) {
    return { expectedActorSeat: null, playersNeedingAction, shouldRoundClose, expectedNextPhase: "DRAW_OR_SHOWDOWN" };
  }
  if (typeof actorSeat === "number" && playersNeedingAction.includes(actorSeat)) {
    return { expectedActorSeat: actorSeat, playersNeedingAction, shouldRoundClose, expectedNextPhase: null };
  }
  const first = expectedBrowserFirstActor({ phase, drawRound, buttonSeat, bbSeat, players: normalized });
  const expectedActorSeat = playersNeedingAction.includes(first) ? first : playersNeedingAction[0];
  return { expectedActorSeat, playersNeedingAction, shouldRoundClose, expectedNextPhase: null };
}
