export function isTournamentEliminatedPlayer(player = {}) {
  if (!player) return false;
  const status = String(player.status ?? player.lastAction ?? "").toUpperCase();
  return Boolean(
    player.eliminated ||
      player.isEliminated ||
      player.busted ||
      player.isBusted ||
      player.seatOut ||
      status === "OUT" ||
      status === "BUSTED",
  );
}

export function compactTournamentSeatViews(seatViews = [], { isTournament = false } = {}) {
  if (!isTournament || !Array.isArray(seatViews)) return Array.isArray(seatViews) ? seatViews : [];
  return seatViews.map((seat) => {
    if (!isTournamentEliminatedPlayer(seat)) return seat;
    return {
      ...seat,
      hiddenFromTableLayout: true,
      folded: true,
      hasFolded: true,
      isTurn: false,
      showHand: false,
    };
  });
}

export function buildTournamentEliminatedRailEntries(seatViews = [], { limit = 5, tournamentPlayers = null } = {}) {
  if (!Array.isArray(seatViews)) return [];
  // Once seats are rehydrated, losers have left the table. Keep their identity
  // and placing from tournament authority instead of treating empty seats as OUT.
  const candidates = tournamentPlayers ? Object.values(tournamentPlayers) : seatViews;
  return candidates
    .filter((seat) => isTournamentEliminatedPlayer(seat))
    .filter((seat) => seat.tournamentPlayerId !== null)
    .sort((a, b) => (b.finishPlace ?? 0) - (a.finishPlace ?? 0))
    .map((seat, index) => ({
      id: seat.tournamentPlayerId ?? seat.playerId ?? seat.id ?? `seat-${seat.seatIndex ?? index}`,
      name: seat.name ?? `Seat ${(seat.seatIndex ?? index) + 1}`,
      place: seat.finishPlace ?? seat.place ?? null,
      stack: Math.max(0, Number(seat.stack) || 0),
      label: seat.label ?? seat.position ?? null,
      status: seat.finishPlace ? `#${seat.finishPlace}` : "OUT",
    }))
    .slice(-Math.max(1, Number(limit) || 5));
}
