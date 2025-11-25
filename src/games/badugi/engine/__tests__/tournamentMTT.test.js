import { describe, it, expect } from "vitest";
import {
  createMTTTournamentState,
  getCurrentLevel,
  onTableHandCompleted,
  rebalanceTables,
  computePayouts,
  simulateBackgroundTables,
} from "../tournamentMTT.js";

const BASE_CONFIG = {
  id: "store-mtt",
  name: "Store Tournament",
  tables: 3,
  seatsPerTable: 6,
  startingStack: 500,
  levels: [
    { levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 2 },
    { levelIndex: 2, smallBlind: 10, bigBlind: 20, ante: 1, handsThisLevel: 2 },
  ],
  payouts: [
    { place: 1, percent: 50 },
    { place: 2, percent: 30 },
    { place: 3, percent: 20 },
  ],
};

const SINGLE_TABLE_CONFIG = {
  ...BASE_CONFIG,
  tables: 1,
};

const entrants = Array.from({ length: 18 }, (_, idx) => ({
  id: `player-${idx + 1}`,
  name: `Player ${idx + 1}`,
}));

describe("tournamentMTT engine", () => {
  it("seats entrants round-robin across 3 tables", () => {
    const state = createMTTTournamentState(BASE_CONFIG, entrants);
    expect(state.tables).toHaveLength(3);
    state.tables.forEach((table) => {
      const occupied = table.seats.filter((seat) => seat.playerId !== null);
      expect(occupied.length).toBe(6);
    });
    expect(Object.keys(state.players)).toHaveLength(18);
  });

  it("advances levels once all active tables meet handsThisLevel", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants);
    expect(getCurrentLevel(state).levelIndex).toBe(1);
    state.tables.forEach((table) => {
      state = onTableHandCompleted(state, table.tableId, {
        seatResults: [],
      });
    });
    // After first cycle, level still 1 (needs 2 hands)
    expect(state.levelIndex).toBe(0);
    state.tables.forEach((table) => {
      state = onTableHandCompleted(state, table.tableId, {
        seatResults: [],
      });
    });
    expect(state.levelIndex).toBe(1);
    expect(getCurrentLevel(state).levelIndex).toBe(2);
  });

  it("marks players busted and reduces playersRemaining", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants);
    const targetTable = state.tables[0];
    const seat = targetTable.seats[0];
    state = onTableHandCompleted(state, targetTable.tableId, {
      handIndex: 1,
      seatResults: [{ seatIndex: seat.seatIndex, playerId: seat.playerId, stack: 0 }],
    });
    const busted = state.players[seat.playerId];
    expect(busted.busted).toBe(true);
    expect(busted.finishPlace).toBe(18);
    expect(state.playersRemaining).toBe(17);
  });

  it("breaks tables as player count drops", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants);
    // Bust six players to reach 12 remaining (should move to 2 tables)
    const toBust = state.tables.flatMap((table) => table.seats.slice(0, 2));
    toBust.slice(0, 6).forEach((seat) => {
      state = onTableHandCompleted(state, state.tables[0].tableId, {
        seatResults: [{ seatIndex: seat.seatIndex, playerId: seat.playerId, stack: 0 }],
      });
    });
    state = rebalanceTables(state);
    const activeTables = state.tables.filter((t) => t.isActive);
    expect(activeTables).toHaveLength(2);
    // Bust another six to force final table
    const survivors = Object.values(state.players).filter((p) => !p.busted);
    survivors.slice(0, 6).forEach((player, idx) => {
      state = onTableHandCompleted(state, state.tables[idx % state.tables.length].tableId, {
        seatResults: [{ seatIndex: player.seatIndex ?? 0, playerId: player.id, stack: 0 }],
      });
    });
    state = rebalanceTables(state);
    expect(state.tables.filter((t) => t.isActive)).toHaveLength(1);
  });

  it("completes the tournament and assigns champion", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants);
    const survivor = state.tables[0].seats[0].playerId;
    Object.values(state.players)
      .filter((p) => p.id !== survivor)
      .forEach((player, idx) => {
        state = onTableHandCompleted(state, state.tables[idx % state.tables.length].tableId, {
          seatResults: [{ seatIndex: player.seatIndex ?? 0, playerId: player.id, stack: 0 }],
        });
      });
    expect(state.isFinished).toBe(true);
    expect(state.championId).toBe(survivor);
    expect(state.players[survivor].finishPlace).toBe(1);
  });

  it("computes payouts based on finish places", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants.slice(0, 3));
    const [p1, p2, p3] = Object.keys(state.players);
    // Bust players 3 -> place 3, player 2 -> place 2, player 1 champion
    state = onTableHandCompleted(state, state.tables[0].tableId, {
      seatResults: [{ seatIndex: 0, playerId: p3, stack: 0 }],
    });
    state = onTableHandCompleted(state, state.tables[0].tableId, {
      seatResults: [{ seatIndex: 1, playerId: p2, stack: 0 }],
    });
    expect(state.isFinished).toBe(true);
    computePayouts(state);
    expect(state.players[p1].payout).toBeGreaterThan(0);
    expect(state.players[p2].payout).toBeGreaterThan(0);
    expect(state.players[p3].payout).toBeGreaterThan(0);
  });

  it("assigns payout amounts matching payout config percentages", () => {
    const config = {
      ...SINGLE_TABLE_CONFIG,
      payouts: [
        { place: 1, percent: 50 },
        { place: 2, percent: 30 },
        { place: 3, percent: 20 },
      ],
    };
    let state = createMTTTournamentState(config, entrants.slice(0, 4));
    const playersInOrder = Object.values(state.players);
    playersInOrder.forEach((player, idx) => {
      player.finishPlace = idx + 1;
    });
    state = computePayouts(state);
    const prizePool = config.startingStack * playersInOrder.length;
    expect(state.players[playersInOrder[0].id].payout).toBe(Math.floor(prizePool * 0.5));
    expect(state.players[playersInOrder[1].id].payout).toBe(Math.floor(prizePool * 0.3));
    expect(state.players[playersInOrder[2].id].payout).toBe(Math.floor(prizePool * 0.2));
    expect(state.players[playersInOrder[3].id].payout).toBe(0);
  });

  it("assigns unique finish places when multiple players bust in the same hand", () => {
    let state = createMTTTournamentState(SINGLE_TABLE_CONFIG, entrants.slice(0, 6));
    const table = state.tables[0];
    const [highPlayer, midPlayer, lowPlayer] = Object.values(state.players).slice(0, 3);
    state.players[highPlayer.id].stack = 400;
    state.players[midPlayer.id].stack = 250;
    state.players[lowPlayer.id].stack = 100;

    state = onTableHandCompleted(state, table.tableId, {
      seatResults: [
        { seatIndex: highPlayer.seatIndex ?? 0, playerId: highPlayer.id, stack: 0 },
        { seatIndex: midPlayer.seatIndex ?? 1, playerId: midPlayer.id, stack: 0 },
        { seatIndex: lowPlayer.seatIndex ?? 2, playerId: lowPlayer.id, stack: 0 },
      ],
    });

    const highPlace = state.players[highPlayer.id].finishPlace;
    const midPlace = state.players[midPlayer.id].finishPlace;
    const lowPlace = state.players[lowPlayer.id].finishPlace;

    expect(new Set([highPlace, midPlace, lowPlace]).size).toBe(3);
    expect(highPlace).toBeLessThan(midPlace);
    expect(midPlace).toBeLessThan(lowPlace);
  });

  it("background simulation busts players and respects tie-breaking", () => {
    let state = createMTTTournamentState(SINGLE_TABLE_CONFIG, entrants.slice(0, 3));
    const seats = state.tables[0].seats;
    const seatWinner = seats[1]; // winner (index 1) due to handIndex % participants
    const seatLoserA = seats[0];
    const seatLoserB = seats[2];
    state.players[seatWinner.playerId].stack = 500;
    state.players[seatLoserA.playerId].stack = 8;
    state.players[seatLoserB.playerId].stack = 5;

    state = simulateBackgroundTables(state, null, { maxHandsPerTable: 1 });

    const firstPlayer = state.players[seatLoserA.playerId];
    const secondPlayer = state.players[seatLoserB.playerId];
    expect(firstPlayer.busted).toBe(true);
    expect(secondPlayer.busted).toBe(true);
    expect(firstPlayer.finishPlace).toBeLessThan(secondPlayer.finishPlace);
  });

  it("background simulation progresses tournament without invalid stacks", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants.slice(0, 9));
    let iterations = 0;
    while (!state.isFinished && iterations < 50) {
      state = simulateBackgroundTables(state, null, { maxHandsPerTable: 2 });
      iterations += 1;
    }
    expect(iterations).toBeGreaterThan(0);
    Object.values(state.players).forEach((player) => {
      expect(player.stack).toBeGreaterThanOrEqual(0);
    });
  });

  it("background simulation never emits NaN stacks", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants.slice(0, 9));
    for (let i = 0; i < 25; i += 1) {
      state = simulateBackgroundTables(state, null, { maxHandsPerTable: 2 });
      Object.values(state.players).forEach((player) => {
        expect(Number.isFinite(player.stack)).toBe(true);
        expect(player.stack).toBeGreaterThanOrEqual(0);
      });
      if (state.isFinished) break;
    }
  });

  it("background simulation eventually finishes small tournaments", () => {
    let state = createMTTTournamentState(SINGLE_TABLE_CONFIG, entrants.slice(0, 4));
    let safety = 0;
    while (!state.isFinished && safety < 50) {
      state = simulateBackgroundTables(state, null, { maxHandsPerTable: 3 });
      safety += 1;
    }
    expect(state.isFinished).toBe(true);
    expect(safety).toBeLessThan(50);
  });

  it("multi-player CPU busts respect starting stack ordering", () => {
    let state = createMTTTournamentState(SINGLE_TABLE_CONFIG, entrants.slice(0, 4));
    const alive = Object.values(state.players);
    const high = alive[0];
    const mid = alive[1];
    const low = alive[2];
    high.stack = 8;
    mid.stack = 6;
    low.stack = 4;
    state = simulateBackgroundTables(state, null, { maxHandsPerTable: 1 });
    expect(state.players[low.id].busted).toBe(true);
    expect(state.players[mid.id].busted).toBe(true);
    expect(state.players[high.id].busted).toBe(true);
    expect(state.players[high.id].finishPlace).toBeLessThan(state.players[mid.id].finishPlace);
    expect(state.players[mid.id].finishPlace).toBeLessThan(state.players[low.id].finishPlace);
  });

  it("produces contiguous finish places when tournament completes", () => {
    let state = createMTTTournamentState(SINGLE_TABLE_CONFIG, entrants.slice(0, 5));
    const tableId = state.tables[0].tableId;
    const playersInOrder = Object.values(state.players);

    playersInOrder.slice(0, -1).forEach((player) => {
      const activeSeatIndex = state.players[player.id].seatIndex ?? 0;
      state = onTableHandCompleted(state, tableId, {
        seatResults: [{ seatIndex: activeSeatIndex, playerId: player.id, stack: 0 }],
      });
    });

    expect(state.isFinished).toBe(true);
    const places = Object.values(state.players)
      .map((player) => player.finishPlace)
      .sort((a, b) => a - b);
    const expected = Array.from({ length: places.length }, (_, idx) => idx + 1);
    expect(places).toEqual(expected);
  });
});
