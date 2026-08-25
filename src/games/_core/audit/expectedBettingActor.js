const BET_PHASES = new Set(["BET", "PREFLOP", "FLOP", "TURN", "RIVER"]);

export function normalizeSeat(seat) {
  if (seat === null || seat === undefined || seat === "") return null;
  const value = Number(seat);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function normalizeSeatSet(seats = []) {
  return new Set(
    (Array.isArray(seats) ? seats : [])
      .map(normalizeSeat)
      .filter((seat) => typeof seat === "number"),
  );
}

export function seatContribution(contributions = {}, seat) {
  if (Array.isArray(contributions)) {
    return Math.max(0, Number(contributions[seat]) || 0);
  }
  return Math.max(0, Number(contributions?.[seat]) || 0);
}

export function isEligibleBettingSeat(seat, { activeSeats = [], foldedSeats = [], allInSeats = [] } = {}) {
  const normalizedSeat = normalizeSeat(seat);
  if (typeof normalizedSeat !== "number") return false;
  const active = normalizeSeatSet(activeSeats);
  const folded = normalizeSeatSet(foldedSeats);
  const allIn = normalizeSeatSet(allInSeats);
  if (active.size > 0 && !active.has(normalizedSeat)) return false;
  return !folded.has(normalizedSeat) && !allIn.has(normalizedSeat);
}

export function nextEligibleSeat(startSeat, playerCount, eligibility = {}) {
  const count = Number(playerCount);
  const start = normalizeSeat(startSeat);
  if (!Number.isInteger(count) || count <= 0 || typeof start !== "number") return null;
  for (let offset = 0; offset < count; offset += 1) {
    const seat = (start + offset) % count;
    if (isEligibleBettingSeat(seat, eligibility)) return seat;
  }
  return null;
}

export function isPreDrawBettingRound({ phase, drawRound } = {}) {
  if (!BET_PHASES.has(String(phase ?? "").toUpperCase())) return false;
  const round = Number(drawRound ?? 0);
  return !Number.isFinite(round) || round <= 0;
}

export function expectedFirstActor({
  playerCount,
  buttonSeat,
  sbSeat,
  bbSeat,
  phase = "BET",
  drawRound = 0,
  activeSeats = [],
  foldedSeats = [],
  allInSeats = [],
} = {}) {
  const count = Number(playerCount);
  if (!Number.isInteger(count) || count <= 0 || !BET_PHASES.has(String(phase ?? "").toUpperCase())) {
    return null;
  }

  const button = normalizeSeat(buttonSeat);
  const smallBlind = normalizeSeat(sbSeat);
  const bigBlind = normalizeSeat(bbSeat);
  const preDraw = isPreDrawBettingRound({ phase, drawRound });

  let startSeat = null;
  if (count <= 2) {
    startSeat = preDraw ? button ?? smallBlind : bigBlind;
  } else {
    startSeat = preDraw
      ? typeof bigBlind === "number"
        ? (bigBlind + 1) % count
        : null
      : typeof button === "number"
        ? (button + 1) % count
        : null;
  }

  return nextEligibleSeat(startSeat, count, { activeSeats, foldedSeats, allInSeats });
}

export function expectedNextActor({
  previousActorSeat,
  playerCount,
  activeSeats = [],
  foldedSeats = [],
  allInSeats = [],
  currentBet = 0,
  contributions = {},
  actedThisStreet = [],
} = {}) {
  const count = Number(playerCount);
  const previous = normalizeSeat(previousActorSeat);
  if (!Number.isInteger(count) || count <= 0 || typeof previous !== "number") return null;

  const acted = normalizeSeatSet(actedThisStreet);
  const requiredBet = Math.max(0, Number(currentBet) || 0);

  for (let offset = 1; offset <= count; offset += 1) {
    const seat = (previous + offset) % count;
    if (!isEligibleBettingSeat(seat, { activeSeats, foldedSeats, allInSeats })) continue;
    const contributed = seatContribution(contributions, seat);
    const hasActedDecision = acted.has(seat);
    if (!hasActedDecision || contributed < requiredBet) {
      return seat;
    }
  }

  return null;
}

export function positionLabelForSeat({ seat, playerCount, buttonSeat, sbSeat, bbSeat } = {}) {
  const normalizedSeat = normalizeSeat(seat);
  const count = Number(playerCount);
  const button = normalizeSeat(buttonSeat);
  const smallBlind = normalizeSeat(sbSeat);
  const bigBlind = normalizeSeat(bbSeat);
  if (typeof normalizedSeat !== "number" || !Number.isInteger(count) || count <= 0) return "UNKNOWN";
  if (normalizedSeat === button && count <= 2) return "BTN/SB";
  if (normalizedSeat === button) return "BTN";
  if (normalizedSeat === smallBlind) return "SB";
  if (normalizedSeat === bigBlind) return "BB";
  if (typeof bigBlind !== "number" || count <= 3) return "UTG";

  const offsetFromUtg = (normalizedSeat - ((bigBlind + 1) % count) + count) % count;
  if (offsetFromUtg === 0) return "UTG";
  if (count === 6) {
    if (offsetFromUtg === 1) return "MP";
    if (offsetFromUtg === 2) return "CO";
  }
  return `P${offsetFromUtg + 1}`;
}
