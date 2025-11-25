import { DEBUG_TOURNAMENT, logMTT } from "../../../config/debugFlags.js";

/**
 * Multi-table Badugi Tournament controller.
 * Provides immutable helpers for initializing tournaments, progressing levels,
 * handling eliminations, rebalancing tables, and computing payouts.
 */

const DEFAULT_TABLE_PREFIX = "table";

/**
 * Create an initial tournament state.
 * @param {TournamentConfigMTT} config
 * @param {Array<{ id: string, name?: string }>} entrants
 * @returns {TournamentStateMTT}
 */
export function createMTTTournamentState(config, entrants) {
  if (!config) {
    throw new Error("Tournament config is required");
  }
  const seatsPerTable = Number(config.seatsPerTable) || 6;
  const tableCount = Math.max(1, Number(config.tables) || 1);
  const startingStack = Math.max(1, Number(config.startingStack) || 1);
  const players = {};
  const tables = Array.from({ length: tableCount }, (_, tableIdx) => ({
    tableId: `${DEFAULT_TABLE_PREFIX}-${tableIdx + 1}`,
    seats: Array.from({ length: seatsPerTable }, (_, seatIdx) => ({
      seatIndex: seatIdx,
      playerId: null,
    })),
    isActive: true,
    handsPlayedAtThisLevel: 0,
  }));

  const contestantList = entrants && entrants.length ? entrants : [];
  contestantList.forEach((entry, idx) => {
    const playerId = entry?.id ?? `player-${idx + 1}`;
    const player = {
      id: playerId,
      name: entry?.name ?? playerId,
      startingStack,
      stack: startingStack,
      busted: false,
      bustHandIndex: null,
      finishPlace: null,
      payout: null,
      tableId: null,
      seatIndex: null,
    };
    const table = tables[idx % tableCount];
    const seatIdx = Math.floor(idx / tableCount) % seatsPerTable;
    const seat = table.seats[seatIdx];
    if (seat.playerId !== null) {
      // Seat occupied, find next open seat.
      const replacementSeat = table.seats.find((s) => s.playerId === null);
      if (!replacementSeat) {
        throw new Error("Not enough seats to place all entrants");
      }
      replacementSeat.playerId = playerId;
      player.tableId = table.tableId;
      player.seatIndex = replacementSeat.seatIndex;
    } else {
      seat.playerId = playerId;
      player.tableId = table.tableId;
      player.seatIndex = seatIdx;
    }
    players[playerId] = player;
  });

  return {
    config,
    levelIndex: 0,
    tables,
    players,
    totalPlayers: contestantList.length,
    playersRemaining: contestantList.length,
    isFinished: false,
    championId: null,
    finishOrder: [],
    abstractHandCounter: 0,
  };
}

/**
 * Return the current level descriptor.
 * @param {TournamentStateMTT} state
 */
export function getCurrentLevel(state) {
  const { config, levelIndex } = state;
  if (!config?.levels?.length) return null;
  return config.levels[Math.min(levelIndex, config.levels.length - 1)];
}

function cloneState(state) {
  return {
    ...state,
    tables: state.tables.map((table) => ({
      ...table,
      seats: table.seats.map((seat) => ({ ...seat })),
    })),
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, player]) => [id, { ...player }]),
    ),
    finishOrder: [...(state.finishOrder ?? [])],
  };
}

/**
 * Record the result of a completed hand at tableId.
 * @param {TournamentStateMTT} state
 * @param {string} tableId
 * @param {{
 *   handIndex?: number,
 *   seatResults: Array<{ seatIndex: number, playerId: string, stack: number, startingStack?: number }>
 * }} handSummary
 */
export function onTableHandCompleted(state, tableId, handSummary) {
  if (state.isFinished) return state;
  const next = cloneState(state);
  const table = next.tables.find((t) => t.tableId === tableId);
  if (!table) {
    throw new Error(`Unknown tableId ${tableId}`);
  }

  const bustQueue = [];
  (handSummary?.seatResults ?? []).forEach((result) => {
    const player = next.players[result.playerId];
    if (!player) return;
    const startingStack = Number.isFinite(result.startingStack)
      ? Math.max(0, Math.floor(result.startingStack))
      : Math.max(0, player.stack);
    player.stack = Math.max(0, Math.floor(result.stack ?? 0));
    if (player.stack === 0) {
      bustQueue.push({
        player,
        seatIndex: result.seatIndex,
        startingStack,
      });
    }
  });
  if (bustQueue.length) {
    bustQueue.sort((a, b) => {
      if (a.startingStack !== b.startingStack) {
        return a.startingStack - b.startingStack;
      }
      return (a.player.id ?? "").localeCompare(b.player.id ?? "");
    });
    bustQueue.forEach((entry) => {
      markPlayerBusted(next, entry.player, handSummary.handIndex ?? null);
      const seat = table.seats[entry.seatIndex];
      if (seat && seat.playerId === entry.player.id) {
        seat.playerId = null;
      }
    });
  }

  table.handsPlayedAtThisLevel += 1;
  maybeAdvanceLevel(next);
  maybeRebalance(next);
  maybeFinalizeTournament(next);
  return next;
}

/**
 * Resize active tables based on players remaining.
 * @param {TournamentStateMTT} state
 */
export function rebalanceTables(state) {
  const next = cloneState(state);
  applyRebalance(next);
  return next;
}

function markPlayerBusted(state, player, handIndex) {
  if (player.busted) return;
  player.busted = true;
  player.bustHandIndex = handIndex ?? null;
  player.tableId = null;
  player.seatIndex = null;
  state.playersRemaining = Math.max(0, state.playersRemaining - 1);
  player.finishPlace = state.playersRemaining + 1;
  state.finishOrder.push(player.id);
  if (DEBUG_TOURNAMENT) {
    logMTT("PLACEMENT", {
      playerId: player.id,
      finishPlace: player.finishPlace,
      playersRemaining: state.playersRemaining,
    });
  }
}

function maybeAdvanceLevel(state) {
  const currentLevel = getCurrentLevel(state);
  if (!currentLevel || currentLevel.handsThisLevel <= 0) {
    return;
  }
  const pending = state.tables.filter((table) => table.isActive);
  if (
    pending.length &&
    pending.every((table) => table.handsPlayedAtThisLevel >= currentLevel.handsThisLevel)
  ) {
    if (state.levelIndex < state.config.levels.length - 1) {
      state.levelIndex += 1;
      if (DEBUG_TOURNAMENT) {
        const level = state.config.levels[state.levelIndex];
        logMTT("LEVEL", {
          levelIndex: level?.levelIndex ?? state.levelIndex + 1,
          playersRemaining: state.playersRemaining,
        });
      }
    }
    state.tables.forEach((table) => {
      table.handsPlayedAtThisLevel = 0;
    });
  }
}

function maybeRebalance(state) {
  applyRebalance(state);
}

function applyRebalance(state) {
  const seatsPerTable = state.config.seatsPerTable;
  const targetTables = Math.max(
    1,
    Math.min(
      state.config.tables,
      Math.ceil(Math.max(1, state.playersRemaining) / seatsPerTable),
    ),
  );
  const activePlayers = Object.values(state.players)
    .filter((p) => !p.busted)
    .sort((a, b) => {
      if (a.tableId === b.tableId) {
        return (a.seatIndex ?? 0) - (b.seatIndex ?? 0);
      }
      return (a.tableId ?? "").localeCompare(b.tableId ?? "");
    });

  const tables = Array.from({ length: state.config.tables }, (_, idx) => ({
    tableId: `${DEFAULT_TABLE_PREFIX}-${idx + 1}`,
  }));

  state.tables = tables.map((meta, idx) => {
    const isActive = idx < targetTables;
    return {
      tableId: meta.tableId,
      seats: Array.from({ length: seatsPerTable }, (_, seatIdx) => ({
        seatIndex: seatIdx,
        playerId: null,
      })),
      isActive,
      handsPlayedAtThisLevel: isActive ? state.tables[idx]?.handsPlayedAtThisLevel ?? 0 : 0,
    };
  });

  activePlayers.forEach((player, idx) => {
    const tableIndex = idx % targetTables;
    const seatIndex = Math.floor(idx / targetTables);
    if (seatIndex >= seatsPerTable) {
      throw new Error("Not enough seats per table during rebalance");
    }
    const table = state.tables[tableIndex];
    table.seats[seatIndex].playerId = player.id;
    player.tableId = table.tableId;
    player.seatIndex = seatIndex;
  });
  if (DEBUG_TOURNAMENT) {
    logMTT("BREAK", {
      playersRemaining: state.playersRemaining,
      activeTables: state.tables.filter((t) => t.isActive).length,
      targetTables,
    });
  }
}

function maybeFinalizeTournament(state) {
  if (state.isFinished) return;
  if (state.playersRemaining <= 1) {
    const champion = Object.values(state.players).find((p) => !p.busted);
    if (champion) {
      champion.finishPlace = 1;
      state.championId = champion.id;
    }
    state.isFinished = true;
    computePayouts(state);
    if (DEBUG_TOURNAMENT) {
      logMTT("PLACEMENT", {
        event: "tournament-finished",
        championId: state.championId,
        finishOrder: state.finishOrder.slice(),
      });
    }
  }
}

/**
 * Compute payouts for the current finish order.
 * Mutates state.players payout fields.
 * @param {TournamentStateMTT} state
 */
export function computePayouts(state) {
  const payouts = state.config?.payouts ?? [];
  const prizePool =
    Math.max(0, Number(state.totalPlayers) || 0) *
    Math.max(0, Number(state.config?.startingStack) || 0);
  const payoutMap = new Map(
    payouts.map((payout) => [payout.place, Math.max(0, Number(payout.percent) || 0)]),
  );
  Object.values(state.players).forEach((player) => {
    const percent = payoutMap.get(player.finishPlace);
    player.payout =
      typeof percent === "number" && percent > 0
        ? Math.floor((percent / 100) * prizePool)
        : 0;
  });
  return state;
}

/**
 * Simulate abstract CPU-only hands on non-hero tables.
 * @param {TournamentStateMTT} state
 * @param {{ excludeTableIds?: string[], handsPerTable?: number }} options
 */
export function simulateBackgroundTables(state, heroTableId = null, options = {}) {
  if (state.isFinished) return state;
  const {
    maxHandsPerTable = 1,
    excludeTableIds = [],
    onHandSimulated = null,
  } = options;
  const excluded = new Set(
    heroTableId ? [heroTableId, ...excludeTableIds] : excludeTableIds,
  );
  let next = cloneState(state);
  const maxHands = Math.max(1, Math.min(3, Math.floor(maxHandsPerTable)));
  for (const table of next.tables) {
    if (!table.isActive || excluded.has(table.tableId)) continue;
    for (let i = 0; i < maxHands && !next.isFinished; i += 1) {
      next = runAbstractHandOnTable(next, table.tableId, { onHandSimulated });
    }
    if (next.isFinished) break;
  }
  return next;
}

function runAbstractHandOnTable(state, tableId, hooks = {}) {
  const { onHandSimulated } = hooks;
  const table = state.tables.find((t) => t.tableId === tableId);
  if (!table) return state;
  const participants = table.seats
    .map((seat) => state.players[seat.playerId])
    .filter((player) => player && !player.busted);
  if (participants.length <= 1) return state;
  let next = cloneState(state);
  next.abstractHandCounter = (next.abstractHandCounter ?? 0) + 1;
  const handIndex = next.abstractHandCounter;
  const baseContribution = Math.max(10, Math.round(next.config.startingStack * 0.02));
  const seatData = participants.map((p) => {
    const player = next.players[p.id];
    return {
      player,
      seatIndex: player.seatIndex ?? 0,
      startingStack: sanitizeStack(player.stack),
    };
  });
  const priorityList = [...seatData].sort((a, b) => {
    if (a.startingStack !== b.startingStack) {
      return b.startingStack - a.startingStack;
    }
    return (a.player.id ?? "").localeCompare(b.player.id ?? "");
  });
  const prioritizedWinner = priorityList[0];
  const winnerIdx = seatData.findIndex(
    (entry) => entry.player.id === prioritizedWinner.player.id,
  );
  const losses = seatData.map((entry, idx) => {
    const pressure = idx === winnerIdx
      ? baseContribution
      : Math.max(baseContribution, Math.round(entry.startingStack * 0.25));
    return Math.min(pressure, entry.startingStack);
  });
  const totalWinnings = losses.reduce((sum, loss) => sum + loss, 0);
  const seatResults = seatData.map((entry, idx) => ({
    seatIndex: entry.seatIndex,
    playerId: entry.player.id,
    startingStack: entry.startingStack,
    stack: sanitizeStack(
      idx === winnerIdx
        ? Math.max(0, entry.startingStack - losses[idx] + totalWinnings)
        : Math.max(0, entry.startingStack - losses[idx]),
    ),
  }));
  const summary = {
    tableId,
    handIndex,
    handId: `cpu-${tableId}-${handIndex}`,
    seatResults,
  };
  if (typeof onHandSimulated === "function") {
    onHandSimulated(summary);
  }
  if (DEBUG_TOURNAMENT) {
    const winner = seatResults[winnerIdx];
    logMTT("CPU", {
      tableId,
      handIndex,
      winnerId: winner?.playerId ?? null,
      totalWinnings,
    });
  }
  return onTableHandCompleted(next, tableId, summary);
}

function sanitizeStack(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return 0;
  }
  return Math.floor(num);
}

/**
 * @typedef {Object} TournamentLevel
 * @property {number} levelIndex
 * @property {number} smallBlind
 * @property {number} bigBlind
 * @property {number} ante
 * @property {number} handsThisLevel
 */

/**
 * @typedef {Object} TournamentConfigMTT
 * @property {string} id
 * @property {string} name
 * @property {number} tables
 * @property {number} seatsPerTable
 * @property {number} startingStack
 * @property {TournamentLevel[]} levels
 * @property {Array<{ place: number, percent: number }>} payouts
 */

/**
 * @typedef {Object} TournamentPlayer
 * @property {string} id
 * @property {string} name
 * @property {number} startingStack
 * @property {number} stack
 * @property {boolean} busted
 * @property {number|null} bustHandIndex
 * @property {number|null} finishPlace
 * @property {number|null} payout
 * @property {string|null} tableId
 * @property {number|null} seatIndex
 */

/**
 * @typedef {Object} TournamentPlayerSlot
 * @property {number} seatIndex
 * @property {string|null} playerId
 */

/**
 * @typedef {Object} TournamentTableState
 * @property {string} tableId
 * @property {TournamentPlayerSlot[]} seats
 * @property {boolean} isActive
 * @property {number} handsPlayedAtThisLevel
 */

/**
 * @typedef {Object} TournamentStateMTT
 * @property {TournamentConfigMTT} config
 * @property {number} levelIndex
 * @property {TournamentTableState[]} tables
 * @property {Record<string, TournamentPlayer>} players
 * @property {number} totalPlayers
 * @property {number} playersRemaining
 * @property {boolean} isFinished
 * @property {string|null} championId
 * @property {string[]} finishOrder
 */
