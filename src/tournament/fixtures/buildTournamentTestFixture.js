import {
  computePayouts,
  createMTTTournamentState,
  getCurrentLevel,
  onTableHandCompleted,
  rebalanceTables,
  simulateBackgroundTables,
} from "../../games/badugi/engine/tournamentMTT.js";

export const CORE5_TOURNAMENT_VARIANTS = ["badugi", "D01", "D02", "S01", "S02"];

export function buildEntrants(count = 6) {
  return Array.from({ length: count }, (_, index) => ({
    id: index === 0 ? "hero" : `cpu-${index}`,
    name: index === 0 ? "Hero" : `CPU ${index}`,
  }));
}

export function buildTournamentConfig(overrides = {}) {
  return {
    id: "core5-integration-fixture",
    name: "Core5 Integration Fixture",
    tables: 1,
    seatsPerTable: 6,
    startingStack: 500,
    gameVariant: "badugi",
    gameRotation: ["badugi"],
    rotationPolicy: "fixed",
    levels: [
      { levelIndex: 1, smallBlind: 10, bigBlind: 20, ante: 0, handsThisLevel: 2 },
      { levelIndex: 2, smallBlind: 20, bigBlind: 40, ante: 5, handsThisLevel: 2 },
      { levelIndex: 3, smallBlind: 40, bigBlind: 80, ante: 10, handsThisLevel: 999 },
    ],
    payouts: [
      { place: 1, percent: 50 },
      { place: 2, percent: 30 },
      { place: 3, percent: 20 },
    ],
    ...overrides,
  };
}

export function buildTournamentTestFixture(type = "default", options = {}) {
  const variant = options.variant ?? "badugi";
  const entrantCount = options.entrantCount ?? defaultEntrantCount(type);
  const typeConfig = {};
  if (type === "tableRebalance" || type === "finalTable") {
    typeConfig.tables = 2;
  }
  const config = buildTournamentConfig({
    ...typeConfig,
    ...(options.config ?? {}),
    gameVariant: variant,
    gameRotation: [variant],
  });
  const entrants = buildEntrants(entrantCount);
  const state = createMTTTournamentState(config, entrants);

  if (type === "shortStackBust") {
    const target = Object.values(state.players).at(-1);
    target.stack = 10;
  }
  if (type === "blindLevelUp") {
    config.levels = [
      { levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 1 },
      { levelIndex: 2, smallBlind: 10, bigBlind: 20, ante: 0, handsThisLevel: 1 },
      { levelIndex: 3, smallBlind: 20, bigBlind: 40, ante: 5, handsThisLevel: 999 },
    ];
  }
  if (type === "bubble" || type === "payout") {
    state.config.payouts = [
      { place: 1, percent: 70 },
      { place: 2, percent: 30 },
    ];
  }

  return {
    type,
    variant,
    config,
    entrants,
    state,
  };
}

function defaultEntrantCount(type) {
  if (type === "tableRebalance" || type === "finalTable") return 12;
  if (type === "bubble" || type === "payout") return 4;
  return 6;
}

export function completeHand(state, tableId, seatResults, handIndex = 1) {
  return onTableHandCompleted(state, tableId, {
    handIndex,
    seatResults,
  });
}

export function activePlayers(state) {
  return Object.values(state.players).filter((player) => !player.busted);
}

export function activeSeatIndexes(state, tableId = state.tables[0]?.tableId) {
  const table = state.tables.find((candidate) => candidate.tableId === tableId);
  if (!table) return [];
  return table.seats
    .filter((seat) => seat.playerId && !state.players[seat.playerId]?.busted)
    .map((seat) => seat.seatIndex)
    .sort((a, b) => a - b);
}

export function validateUniqueActivePlayers(state) {
  const seen = new Set();
  for (const table of state.tables.filter((candidate) => candidate.isActive)) {
    for (const seat of table.seats) {
      if (!seat.playerId) continue;
      if (seen.has(seat.playerId)) {
        return { valid: false, reason: `duplicate player ${seat.playerId}` };
      }
      if (state.players[seat.playerId]?.busted) {
        return { valid: false, reason: `busted player reseated ${seat.playerId}` };
      }
      seen.add(seat.playerId);
    }
  }
  return { valid: true, activePlayerCount: seen.size };
}

export function calculateButtonBlindAssignment({ activeSeats, previousButtonSeat = null }) {
  const seats = [...activeSeats].sort((a, b) => a - b);
  if (!seats.length) return { buttonSeat: null, sbSeat: null, bbSeat: null, policy: "no-active-seat" };
  const buttonSeat =
    previousButtonSeat == null
      ? seats[0]
      : nextSeatClockwise(seats, previousButtonSeat);
  if (seats.length === 1) {
    return { buttonSeat, sbSeat: null, bbSeat: null, policy: "single-player-terminal" };
  }
  if (seats.length === 2) {
    return {
      buttonSeat,
      sbSeat: buttonSeat,
      bbSeat: nextSeatClockwise(seats, buttonSeat),
      policy: "heads-up-button-is-sb",
    };
  }
  const sbSeat = nextSeatClockwise(seats, buttonSeat);
  const bbSeat = nextSeatClockwise(seats, sbSeat);
  return { buttonSeat, sbSeat, bbSeat, policy: "no-dead-button" };
}

export function nextSeatClockwise(activeSeats, fromSeat) {
  const seats = [...activeSeats].sort((a, b) => a - b);
  if (!seats.length) return null;
  const greater = seats.find((seat) => seat > fromSeat);
  return greater ?? seats[0];
}

export function buildSidePots(contributions, foldedSeats = []) {
  const folded = new Set(foldedSeats);
  const entries = Object.entries(contributions)
    .map(([seat, amount]) => ({ seat: Number(seat), amount: Math.max(0, Number(amount) || 0) }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => a.amount - b.amount);
  const levels = [...new Set(entries.map((entry) => entry.amount))].sort((a, b) => a - b);
  let previous = 0;
  return levels.map((level) => {
    const contributors = entries.filter((entry) => entry.amount >= level).map((entry) => entry.seat);
    const eligible = contributors.filter((seat) => !folded.has(seat));
    const amount = (level - previous) * contributors.length;
    previous = level;
    return { amount, contributors, eligible };
  });
}

export function finishTournamentToChampion(state, championId = activePlayers(state)[0]?.id) {
  let next = state;
  let handIndex = 1;
  for (const player of activePlayers(next)) {
    if (player.id === championId) continue;
    const livePlayer = next.players[player.id];
    next = completeHand(
      next,
      livePlayer.tableId ?? next.tables[0].tableId,
      [{
        seatIndex: livePlayer.seatIndex ?? 0,
        playerId: livePlayer.id,
        startingStack: livePlayer.stack,
        stack: 0,
      }],
      handIndex,
    );
    handIndex += 1;
    if (next.isFinished) break;
  }
  return next;
}

export function serializeResumeSnapshot(state) {
  return JSON.parse(JSON.stringify({
    version: 1,
    savedAt: "2026-05-17T00:00:00.000Z",
    state,
  }));
}

export function restoreResumeSnapshot(snapshot) {
  if (!snapshot || snapshot.version !== 1 || !snapshot.state) {
    return null;
  }
  return JSON.parse(JSON.stringify(snapshot.state));
}

export function runBackgroundTournamentToCompletion(state, maxIterations = 100) {
  let next = state;
  let iterations = 0;
  while (!next.isFinished && iterations < maxIterations) {
    next = simulateBackgroundTables(next, null, { maxHandsPerTable: 3 });
    iterations += 1;
  }
  return { state: next, iterations };
}

export { computePayouts, getCurrentLevel, rebalanceTables, simulateBackgroundTables };
