import { DEBUG_TOURNAMENT, logMTT } from "../../../config/debugFlags.js";

/**
 * Multi-table Badugi Tournament controller.
 * Provides immutable helpers for initializing tournaments, progressing levels,
 * handling eliminations, rebalancing tables, and computing payouts.
 */

const DEFAULT_TABLE_PREFIX = "table";

function createTournamentRunId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `mtt-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

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
      cpuCharacterId: entry?.cpuCharacterId ?? null,
      cpuStyle: entry?.cpuStyle ?? null,
      avatarUrl: entry?.avatarUrl ?? null,
      opponentProfileId: entry?.opponentProfileId ?? null,
      opponentTitle: entry?.opponentTitle ?? entry?.titleBadge ?? null,
      titleBadge: entry?.titleBadge ?? entry?.opponentTitle ?? null,
      tierId: entry?.tierId ?? null,
      personalityId: entry?.personalityId ?? null,
      personality: entry?.personality ?? null,
      personalityBadge: entry?.personalityBadge ?? null,
      avatarId: entry?.avatarId ?? null,
      flavorText: entry?.flavorText ?? null,
      traits: Array.isArray(entry?.traits) ? [...entry.traits] : [],
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
    tournamentRunId: createTournamentRunId(),
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
    completedHandIds: [],
    events: [],
    lastEvent: null,
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
    completedHandIds: [...(state.completedHandIds ?? [])],
    events: (state.events ?? []).map((event) => ({ ...event })),
    lastEvent: state.lastEvent ? { ...state.lastEvent } : null,
  };
}

/**
 * Record the result of a completed hand at tableId.
 * @param {TournamentStateMTT} state
 * @param {string} tableId
 * @param {{
 *   handId?: string,
 *   handIndex?: number,
 *   seatResults: Array<{ seatIndex: number, playerId: string, stack: number, startingStack?: number }>
 * }} handSummary
 */
export function onTableHandCompleted(state, tableId, handSummary) {
  if (state.isFinished) return state;
  const completionKey = handSummary?.handId
    ? `${tableId}:${handSummary.handId}`
    : null;
  // The UI has more than one showdown completion path for compatibility with
  // controller and legacy games.  They may converge on the same real hand;
  // tournament progression must remain exactly-once even if both report it.
  if (completionKey && (state.completedHandIds ?? []).includes(completionKey)) {
    return state;
  }
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
      clearPlayerFromAllTables(next, entry.player.id);
    });
  }

  table.handsPlayedAtThisLevel += 1;
  if (completionKey) {
    next.completedHandIds.push(completionKey);
    if (next.completedHandIds.length > 4096) {
      next.completedHandIds.splice(0, next.completedHandIds.length - 4096);
    }
  }
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
      const previousLevel = state.levelIndex + 1;
      state.levelIndex += 1;
      appendTournamentEvent(state, {
        type: "LEVEL_ADVANCED",
        fromLevel: previousLevel,
        toLevel: state.levelIndex + 1,
        playersRemaining: state.playersRemaining,
      });
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
  if (shouldRebalance(state)) {
    applyRebalance(state);
  }
  maybeEmitTournamentMilestoneEvents(state);
}

function hasTournamentEvent(state, type) {
  return (state.events ?? []).some((event) => event?.type === type);
}

function getPaidPlaces(state) {
  const payouts = Array.isArray(state?.config?.payouts) ? state.config.payouts : [];
  const paidPlaces = payouts
    .map((payout) => Number(payout?.place))
    .filter((place) => Number.isFinite(place) && place > 0);
  return paidPlaces.length ? Math.max(...paidPlaces) : 3;
}

function appendTournamentEvent(state, event) {
  const nextEvent = {
    ...event,
    sequence: (state.events?.length ?? 0) + 1,
  };
  state.events = [...(state.events ?? []), nextEvent];
  state.lastEvent = nextEvent;
}

function targetActiveTableCount(state) {
  const seatsPerTable = state.config.seatsPerTable;
  return Math.max(
    1,
    Math.min(
      state.config.tables,
      Math.ceil(Math.max(1, state.playersRemaining) / seatsPerTable),
    ),
  );
}

function tableActivePlayerIds(state, table) {
  return table.seats
    .map((seat) => seat.playerId)
    .filter((playerId) => playerId && !state.players[playerId]?.busted);
}

function tablePopulation(state, table) {
  return tableActivePlayerIds(state, table).length;
}

function activeTables(state) {
  return state.tables.filter((table) => table.isActive);
}

function isHeroPlayer(player) {
  return player?.id === "hero" || String(player?.name ?? "").toLowerCase() === "hero";
}

function getHeroTableId(state) {
  const hero = Object.values(state.players).find(
    (player) => !player.busted && isHeroPlayer(player),
  );
  return hero?.tableId ?? null;
}

function shouldRebalance(state) {
  const active = activeTables(state);
  if (!active.length) return false;
  const targetTables = targetActiveTableCount(state);
  if (active.length !== targetTables) return true;
  const counts = active.map((table) => tablePopulation(state, table));
  if (counts.length <= 1) return false;
  return Math.max(...counts) - Math.min(...counts) > 1;
}

function maybeEmitTournamentMilestoneEvents(state) {
  const tablesActive = Math.max(1, activeTables(state).length || targetActiveTableCount(state));
  const paidPlaces = getPaidPlaces(state);
  if (
    state.playersRemaining <= paidPlaces + 1 &&
    !hasTournamentEvent(state, "MONEY_BUBBLE")
  ) {
    appendTournamentEvent(state, {
      type: "MONEY_BUBBLE",
      playersRemaining: state.playersRemaining,
      paidPlaces,
    });
  }
  if (state.playersRemaining <= 3 && !hasTournamentEvent(state, "TOP_THREE")) {
    appendTournamentEvent(state, {
      type: "TOP_THREE",
      playersRemaining: state.playersRemaining,
    });
  }
  if (state.playersRemaining <= 2 && !hasTournamentEvent(state, "HEADS_UP")) {
    appendTournamentEvent(state, {
      type: "HEADS_UP",
      playersRemaining: state.playersRemaining,
      tablesActive,
    });
  }
}

function clearPlayerFromTable(table, playerId) {
  const seat = table.seats.find((entry) => entry.playerId === playerId);
  if (seat) {
    seat.playerId = null;
  }
}

function clearPlayerFromAllTables(state, playerId) {
  state.tables.forEach((table) => clearPlayerFromTable(table, playerId));
}

function findFirstOpenSeat(table) {
  return table.seats.find((seat) => seat.playerId === null) ?? null;
}

function movePlayerToTable(state, playerId, fromTable, toTable) {
  const player = state.players[playerId];
  const openSeat = findFirstOpenSeat(toTable);
  if (!player || !openSeat) {
    return false;
  }
  if (fromTable?.tableId !== toTable.tableId) {
    clearPlayerFromTable(fromTable, playerId);
  }
  openSeat.playerId = playerId;
  player.tableId = toTable.tableId;
  player.seatIndex = openSeat.seatIndex;
  return true;
}

function chooseTablesToDeactivate(state, targetTables) {
  const active = activeTables(state);
  const removeCount = Math.max(0, active.length - targetTables);
  if (removeCount <= 0) return [];
  const heroTableId = getHeroTableId(state);
  return [...active]
    .sort((a, b) => {
      const heroDelta = Number(a.tableId === heroTableId) - Number(b.tableId === heroTableId);
      if (heroDelta !== 0) return heroDelta;
      const populationDelta = tablePopulation(state, a) - tablePopulation(state, b);
      if (populationDelta !== 0) return populationDelta;
      return a.tableId.localeCompare(b.tableId);
    })
    .slice(0, removeCount);
}

function chooseRecipientTable(state, excludedTableIds = new Set()) {
  return activeTables(state)
    .filter((table) => !excludedTableIds.has(table.tableId) && findFirstOpenSeat(table))
    .sort((a, b) => {
      const populationDelta = tablePopulation(state, a) - tablePopulation(state, b);
      if (populationDelta !== 0) return populationDelta;
      return a.tableId.localeCompare(b.tableId);
    })[0] ?? null;
}

function compactInactiveTables(state) {
  state.tables.forEach((table) => {
    if (!table.isActive) {
      table.seats.forEach((seat) => {
        seat.playerId = null;
      });
      table.handsPlayedAtThisLevel = 0;
    }
  });
}

function mergeTables(state, targetTables) {
  const previousActiveTables = activeTables(state).length;
  const closingTables = chooseTablesToDeactivate(state, targetTables);
  const closingIds = new Set(closingTables.map((table) => table.tableId));
  const movers = closingTables.flatMap((table) =>
    table.seats
      .filter((seat) => seat.playerId && !state.players[seat.playerId]?.busted)
      .map((seat) => ({ playerId: seat.playerId, fromTable: table, seatIndex: seat.seatIndex }))
      .sort((a, b) => a.seatIndex - b.seatIndex),
  );

  closingTables.forEach((table) => {
    table.isActive = false;
    table.handsPlayedAtThisLevel = 0;
    table.seats.forEach((seat) => {
      seat.playerId = null;
    });
  });

  movers.forEach(({ playerId, fromTable }) => {
    const recipient = chooseRecipientTable(state, closingIds);
    if (!recipient || !movePlayerToTable(state, playerId, fromTable, recipient)) {
      throw new Error("Not enough seats per table during rebalance");
    }
  });

  if (previousActiveTables > targetTables) {
    appendTournamentEvent(state, {
      type: targetTables === 1 ? "FINAL_TABLE" : "TABLE_MERGE",
      fromTables: previousActiveTables,
      toTables: targetTables,
      playersRemaining: state.playersRemaining,
    });
  }
  compactInactiveTables(state);
}

function rebalanceImbalancedTables(state) {
  let safety = state.config.tables * state.config.seatsPerTable;
  while (safety > 0) {
    safety -= 1;
    const active = activeTables(state);
    if (active.length <= 1) return;
    const sorted = [...active].sort((a, b) => {
      const populationDelta = tablePopulation(state, a) - tablePopulation(state, b);
      if (populationDelta !== 0) return populationDelta;
      return a.tableId.localeCompare(b.tableId);
    });
    const low = sorted[0];
    const highCandidates = [...sorted].reverse();
    const high = highCandidates.find((table) => {
      const movableSeats = table.seats.filter((seat) => {
        const player = state.players[seat.playerId];
        return player && !player.busted && !isHeroPlayer(player);
      });
      return movableSeats.length > 0;
    }) ?? highCandidates[0];
    if (tablePopulation(state, high) - tablePopulation(state, low) <= 1) {
      return;
    }
    const fromSeat = [...high.seats]
      .reverse()
      .find((seat) => {
        const player = state.players[seat.playerId];
        return player && !player.busted && !isHeroPlayer(player);
      }) ??
      [...high.seats]
        .reverse()
        .find((seat) => seat.playerId && !state.players[seat.playerId]?.busted);
    if (!fromSeat || !findFirstOpenSeat(low)) return;
    movePlayerToTable(state, fromSeat.playerId, high, low);
  }
}

function applyRebalance(state) {
  const targetTables = targetActiveTableCount(state);

  if (activeTables(state).length > targetTables) {
    mergeTables(state, targetTables);
  }

  if (activeTables(state).length < targetTables) {
    state.tables.slice(0, targetTables).forEach((table) => {
      table.isActive = true;
    });
  }

  rebalanceImbalancedTables(state);
  maybeEmitTournamentMilestoneEvents(state);
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
  const rewards = state.config?.rewards ?? [];
  const prizePool =
    Math.max(0, Number(state.config?.prizePoolTotal) || 0) ||
    Math.max(0, Number(state.totalPlayers) || 0) *
      Math.max(0, Number(state.config?.startingStack) || 0);
  const payoutMap = new Map(
    payouts.map((payout) => [payout.place, Math.max(0, Number(payout.percent) || 0)]),
  );
  const rewardMap = new Map(
    rewards.map((reward) => [reward.place, Math.max(0, Number(reward.amount) || 0)]),
  );
  Object.values(state.players).forEach((player) => {
    const reward = rewardMap.get(player.finishPlace);
    const percent = payoutMap.get(player.finishPlace);
    player.payout =
      typeof reward === "number" && reward > 0
        ? reward
        : typeof percent === "number" && percent > 0
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
 * @property {string[]} completedHandIds
 * @property {Array<Object>} events
 * @property {Object|null} lastEvent
 */
