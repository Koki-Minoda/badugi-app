import { describe, it, expect } from "vitest";
import {
  createMTTTournamentState,
  getCurrentLevel,
  onTableHandCompleted,
  rebalanceTables,
  computePayouts,
  simulateBackgroundTables,
} from "../tournamentMTT.js";
import { STORE_STANDARD_BLIND_LEVELS } from "../../../../config/tournamentBlindSheets.js";

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

const STORE_15_LEVEL_CONFIG = {
  ...BASE_CONFIG,
  levels: STORE_STANDARD_BLIND_LEVELS,
};

const entrants = Array.from({ length: 18 }, (_, idx) => ({
  id: `player-${idx + 1}`,
  name: `Player ${idx + 1}`,
}));

function activeTableCount(state) {
  return state.tables.filter((table) => table.isActive).length;
}

function seatedPlayerIds(state) {
  return new Set(
    state.tables.flatMap((table) =>
      table.seats.map((seat) => seat.playerId).filter(Boolean),
    ),
  );
}

function bustAlivePlayers(state, count, handIndex = 1) {
  const playersToBust = Object.values(state.players)
    .filter((player) => !player.busted)
    .slice(0, count);
  return onTableHandCompleted(state, playersToBust[0].tableId, {
    handIndex,
    seatResults: playersToBust.map((player) => ({
      seatIndex: player.seatIndex ?? 0,
      playerId: player.id,
      stack: 0,
      startingStack: player.stack,
    })),
  });
}

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

  it("preserves CPU character metadata for tournament table display", () => {
    const state = createMTTTournamentState(BASE_CONFIG, [
      entrants[0],
      {
        id: "cpu-akira",
        name: "Akira",
        cpuCharacterId: "akira",
        cpuStyle: "balanced",
        avatarUrl: "/characters/akira.png",
        opponentProfileId: "store-mika",
        opponentTitle: "Store Regular",
        titleBadge: "Store Regular",
        tierId: "standard",
        personalityId: "calling-station",
        personality: { id: "calling-station", label: "Calling Station" },
        personalityBadge: "Calling Station",
        avatarId: "mika",
        flavorText: "Calls too much, but never gives up.",
        traits: ["loose", "sticky"],
      },
    ]);
    expect(state.players["cpu-akira"].name).toBe("Akira");
    expect(state.players["cpu-akira"].cpuCharacterId).toBe("akira");
    expect(state.players["cpu-akira"].cpuStyle).toBe("balanced");
    expect(state.players["cpu-akira"].avatarUrl).toBe("/characters/akira.png");
    expect(state.players["cpu-akira"].opponentProfileId).toBe("store-mika");
    expect(state.players["cpu-akira"].opponentTitle).toBe("Store Regular");
    expect(state.players["cpu-akira"].tierId).toBe("standard");
    expect(state.players["cpu-akira"].personalityId).toBe("calling-station");
    expect(state.players["cpu-akira"].personalityBadge).toBe("Calling Station");
    expect(state.players["cpu-akira"].traits).toEqual(["loose", "sticky"]);
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

  it("advances store blind sheet through level 4 without terminal 999 hands", () => {
    let state = createMTTTournamentState(STORE_15_LEVEL_CONFIG, entrants);
    expect(STORE_15_LEVEL_CONFIG.levels).toHaveLength(15);
    expect(getCurrentLevel(state).levelIndex).toBe(1);

    for (let targetLevelIndex = 1; targetLevelIndex <= 3; targetLevelIndex += 1) {
      for (let hand = 0; hand < 5; hand += 1) {
        const activeTableIds = state.tables
          .filter((table) => table.isActive)
          .map((table) => table.tableId);
        activeTableIds.forEach((tableId) => {
          state = onTableHandCompleted(state, tableId, {
            handIndex: hand + 1,
            seatResults: [],
          });
        });
      }

      expect(state.levelIndex).toBe(targetLevelIndex);
      expect(getCurrentLevel(state).levelIndex).toBe(targetLevelIndex + 1);
      expect(getCurrentLevel(state).handsThisLevel).toBe(5);
    }

    expect(getCurrentLevel(state).smallBlind).toBe(30);
    expect(getCurrentLevel(state).bigBlind).toBe(60);
  });

  it("increments handsPlayedAtThisLevel before level advancement", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants);
    const tableId = state.tables[0].tableId;

    state = onTableHandCompleted(state, tableId, {
      handIndex: 1,
      seatResults: [],
    });
    expect(state.tables[0].handsPlayedAtThisLevel).toBe(1);

    state = onTableHandCompleted(state, tableId, {
      handIndex: 2,
      seatResults: [],
    });
    expect(state.tables[0].handsPlayedAtThisLevel).toBe(2);
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

  it("emits TABLE_MERGE when 18 players contract to 12 across two tables", () => {
    const state = bustAlivePlayers(createMTTTournamentState(BASE_CONFIG, entrants), 6);
    const mergeEvent = state.events.find((event) => event.type === "TABLE_MERGE");

    expect(state.playersRemaining).toBe(12);
    expect(activeTableCount(state)).toBe(2);
    expect(mergeEvent).toMatchObject({
      type: "TABLE_MERGE",
      fromTables: 3,
      toTables: 2,
      playersRemaining: 12,
    });
    expect(state.lastEvent).toEqual(mergeEvent);
  });

  it("emits FINAL_TABLE when 12 players contract to one active table", () => {
    let state = bustAlivePlayers(createMTTTournamentState(BASE_CONFIG, entrants), 6, 1);
    state = bustAlivePlayers(state, 6, 2);
    const finalTableEvent = state.events.find((event) => event.type === "FINAL_TABLE");

    expect(state.playersRemaining).toBe(6);
    expect(activeTableCount(state)).toBe(1);
    expect(finalTableEvent).toMatchObject({
      type: "FINAL_TABLE",
      fromTables: 2,
      toTables: 1,
      playersRemaining: 6,
    });
    expect(state.lastEvent).toEqual(finalTableEvent);
  });

  it("emits HEADS_UP at two players without reseating busted players", () => {
    let state = bustAlivePlayers(createMTTTournamentState(BASE_CONFIG, entrants), 6, 1);
    state = bustAlivePlayers(state, 6, 2);
    const playersToBust = Object.values(state.players)
      .filter((player) => !player.busted)
      .slice(0, 4);
    state = onTableHandCompleted(state, playersToBust[0].tableId, {
      handIndex: 3,
      seatResults: playersToBust.map((player) => ({
        seatIndex: player.seatIndex ?? 0,
        playerId: player.id,
        stack: 0,
        startingStack: player.stack,
      })),
    });
    const headsUpEvent = state.events.find((event) => event.type === "HEADS_UP");
    const seatedIds = seatedPlayerIds(state);

    expect(state.playersRemaining).toBe(2);
    expect(activeTableCount(state)).toBe(1);
    expect(headsUpEvent).toMatchObject({
      type: "HEADS_UP",
      playersRemaining: 2,
      tablesActive: 1,
    });
    playersToBust.forEach((player) => {
      expect(state.players[player.id].busted).toBe(true);
      expect(seatedIds.has(player.id)).toBe(false);
    });
    expect(state.lastEvent).toEqual(headsUpEvent);
  });

  it("emits MONEY_BUBBLE at four players remaining", () => {
    let state = bustAlivePlayers(createMTTTournamentState(BASE_CONFIG, entrants), 6, 1);
    state = bustAlivePlayers(state, 6, 2);
    state = bustAlivePlayers(state, 2, 3);
    const bubbleEvent = state.events.find((event) => event.type === "MONEY_BUBBLE");

    expect(state.playersRemaining).toBe(4);
    expect(bubbleEvent).toMatchObject({
      type: "MONEY_BUBBLE",
      playersRemaining: 4,
      paidPlaces: 3,
    });
    expect(state.lastEvent).toEqual(bubbleEvent);
  });

  it("emits TOP_THREE at three players remaining", () => {
    let state = bustAlivePlayers(createMTTTournamentState(BASE_CONFIG, entrants), 6, 1);
    state = bustAlivePlayers(state, 6, 2);
    state = bustAlivePlayers(state, 2, 3);
    state = bustAlivePlayers(state, 1, 4);
    const topThreeEvent = state.events.find((event) => event.type === "TOP_THREE");

    expect(state.playersRemaining).toBe(3);
    expect(topThreeEvent).toMatchObject({
      type: "TOP_THREE",
      playersRemaining: 3,
    });
    expect(state.lastEvent).toEqual(topThreeEvent);
  });

  it("balances 14 remaining players across three tables as 5/5/4 instead of leaving a 3-way table", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants);
    const playersToBust = Object.values(state.players).slice(0, 4);
    state = onTableHandCompleted(state, playersToBust[0].tableId, {
      handIndex: 12,
      seatResults: playersToBust.map((player) => ({
        seatIndex: player.seatIndex ?? 0,
        playerId: player.id,
        stack: 0,
        startingStack: player.stack,
      })),
    });

    expect(state.playersRemaining).toBe(14);
    const activeCounts = state.tables
      .filter((table) => table.isActive)
      .map((table) => table.seats.filter((seat) => seat.playerId !== null).length)
      .sort((a, b) => b - a);
    expect(activeCounts).toEqual([5, 5, 4]);
    expect(Math.max(...activeCounts) - Math.min(...activeCounts)).toBeLessThanOrEqual(1);
  });

  it("preserves playersRemaining and blind progression after CPU bust rebalance", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants);
    const targetTable = state.tables[0];
    const cpuSeat = targetTable.seats.find((seat) => seat.playerId !== null);
    state = onTableHandCompleted(state, targetTable.tableId, {
      handIndex: 1,
      seatResults: [
        {
          seatIndex: cpuSeat.seatIndex,
          playerId: cpuSeat.playerId,
          stack: 0,
          startingStack: state.players[cpuSeat.playerId].stack,
        },
      ],
    });
    state = rebalanceTables(state);

    expect(state.totalPlayers).toBe(18);
    expect(state.playersRemaining).toBe(17);
    expect(Object.values(state.players).filter((player) => !player.busted)).toHaveLength(17);
    expect(
      state.tables
        .filter((table) => table.isActive)
        .map((table) => table.seats.filter((seat) => seat.playerId !== null).length)
        .sort((a, b) => b - a),
    ).toEqual([6, 6, 5]);
    expect(state.levelIndex).toBe(0);

    for (let cycle = 0; cycle < 2; cycle += 1) {
      const activeTableIds = state.tables
        .filter((table) => table.isActive)
        .map((table) => table.tableId);
      activeTableIds.forEach((tableId) => {
        state = onTableHandCompleted(state, tableId, {
          handIndex: cycle + 2,
          seatResults: [],
        });
      });
    }

    expect(state.playersRemaining).toBe(17);
    expect(state.levelIndex).toBe(1);
    expect(getCurrentLevel(state).smallBlind).toBe(10);
    expect(getCurrentLevel(state).bigBlind).toBe(20);
    state.tables
      .filter((table) => table.isActive)
      .forEach((table) => {
        expect(table.handsPlayedAtThisLevel).toBe(0);
      });
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

  it("PLAYERS-REMAINING-001 18 players, 1 bust -> playersRemaining is 17 and never reverts", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants);
    expect(state.playersRemaining).toBe(18);
    const targetTable = state.tables[0];
    const seat = targetTable.seats[0];
    state = onTableHandCompleted(state, targetTable.tableId, {
      handIndex: 1,
      seatResults: [
        { seatIndex: seat.seatIndex, playerId: seat.playerId, stack: 0, startingStack: 500 },
      ],
    });
    expect(state.playersRemaining).toBe(17);
    expect(state.players[seat.playerId].busted).toBe(true);
    // Verify count is not reverted by a no-op hand
    state = onTableHandCompleted(state, targetTable.tableId, { seatResults: [] });
    expect(state.playersRemaining).toBe(17);
  });

  it("PLAYERS-REMAINING-002 18 players, 3 busts -> playersRemaining is 15 and holds", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants);
    const table = state.tables[0];
    const bustSeats = table.seats.slice(0, 3);
    state = onTableHandCompleted(state, table.tableId, {
      handIndex: 1,
      seatResults: bustSeats.map((s) => ({
        seatIndex: s.seatIndex,
        playerId: s.playerId,
        stack: 0,
        startingStack: 500,
      })),
    });
    expect(state.playersRemaining).toBe(15);
    bustSeats.forEach((s) => expect(state.players[s.playerId].busted).toBe(true));
    // Background simulation should not revive them
    const nextState = simulateBackgroundTables(state, table.tableId, { maxHandsPerTable: 1 });
    expect(nextState.playersRemaining).toBeLessThanOrEqual(15);
    bustSeats.forEach((s) => expect(nextState.players[s.playerId].busted).toBe(true));
  });

  it("PLAYERS-REMAINING-003 playersRemaining is stable after rebalance with 15 alive", () => {
    let state = createMTTTournamentState(BASE_CONFIG, entrants);
    // Bust 3 players to reach 15
    const table = state.tables[0];
    const bustSeats = table.seats.slice(0, 3);
    state = onTableHandCompleted(state, table.tableId, {
      handIndex: 1,
      seatResults: bustSeats.map((s) => ({
        seatIndex: s.seatIndex,
        playerId: s.playerId,
        stack: 0,
        startingStack: 500,
      })),
    });
    expect(state.playersRemaining).toBe(15);
    // Explicit rebalance must not change the count
    state = rebalanceTables(state);
    expect(state.playersRemaining).toBe(15);
    const alivePlayers = Object.values(state.players).filter((p) => !p.busted);
    expect(alivePlayers.length).toBe(15);
    // busted players must not reappear in any table seat
    const allSeatedIds = new Set(
      state.tables.flatMap((t) => t.seats.map((s) => s.playerId).filter(Boolean)),
    );
    bustSeats.forEach((s) => expect(allSeatedIds.has(s.playerId)).toBe(false));
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
