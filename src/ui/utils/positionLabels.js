const DEFAULT_POSITION_ORDER = Object.freeze(["BTN", "SB", "BB", "UTG", "MP", "CO", "HJ", "LJ"]);

export function isLiveSeatForPosition(player) {
  if (!player) return false;
  if (player.isActiveInGame === false) return false;
  if (player.seatOut || player.sittingOut || player.isBusted) return false;
  if (player.seatType && String(player.seatType).toUpperCase() === "EMPTY") return false;
  if (typeof player.stack === "number" && player.stack <= 0 && !player.allIn) return false;
  return true;
}

export function getLiveSeatOrder(players = [], dealerIdx = 0) {
  const list = Array.isArray(players) ? players : [];
  if (!list.length) return [];
  const activeSeats = list
    .map((player, seatIndex) => ({ player, seatIndex }))
    .filter(({ player }) => isLiveSeatForPosition(player))
    .map(({ seatIndex }) => seatIndex);
  if (!activeSeats.length) return [];
  const seatCount = list.length;
  const safeDealer = Number.isFinite(Number(dealerIdx)) ? Number(dealerIdx) : 0;
  const buttonSeat = activeSeats.includes(safeDealer)
    ? safeDealer
    : activeSeats.find((seatIndex) => ((seatIndex - safeDealer + seatCount) % seatCount) > 0) ??
      activeSeats[0];
  const buttonOrder = [buttonSeat];
  for (let offset = 1; offset < seatCount; offset += 1) {
    const seatIndex = (buttonSeat + offset) % seatCount;
    if (activeSeats.includes(seatIndex)) {
      buttonOrder.push(seatIndex);
    }
  }
  return buttonOrder;
}

export function getPositionNameForSeat(index, dealerIdx = 0, players = []) {
  const seatCount = Array.isArray(players) && players.length ? players.length : 6;
  if (!Array.isArray(players) || players.length === 0) {
    const rel = ((index - dealerIdx) % seatCount + seatCount) % seatCount;
    return DEFAULT_POSITION_ORDER[rel] ?? `Seat ${index + 1}`;
  }

  const liveOrder = getLiveSeatOrder(players, dealerIdx);
  const relativeIndex = liveOrder.indexOf(index);
  if (relativeIndex < 0) {
    return "OUT";
  }
  if (liveOrder.length === 2) {
    return relativeIndex === 0 ? "BTN/SB" : "BB";
  }
  return DEFAULT_POSITION_ORDER[relativeIndex] ?? `Seat ${index + 1}`;
}

export function getBlindSeatIndexes(players = [], dealerIdx = 0) {
  const liveOrder = getLiveSeatOrder(players, dealerIdx);
  if (liveOrder.length < 2) {
    return { sbIdx: null, bbIdx: null };
  }
  if (liveOrder.length === 2) {
    return { sbIdx: liveOrder[0], bbIdx: liveOrder[1] };
  }
  return { sbIdx: liveOrder[1], bbIdx: liveOrder[2] };
}
