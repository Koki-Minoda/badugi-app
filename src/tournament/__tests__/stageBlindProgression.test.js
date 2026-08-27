import { describe, expect, it } from "vitest";
import { buildTournamentConfigFromStage } from "../../config/tournamentStages.js";
import {
  createMTTTournamentState,
  getCurrentLevel,
  onTableHandCompleted,
  simulateBackgroundTables,
} from "../../games/badugi/engine/tournamentMTT.js";

const STAGE_EXPECTATIONS = [
  {
    stageId: "store",
    totalPlayers: 18,
    tables: 3,
    levels: 15,
    initial: { smallBlind: 5, bigBlind: 10, ante: 0 },
    next: { smallBlind: 10, bigBlind: 20, ante: 1 },
  },
  {
    stageId: "local",
    totalPlayers: 45,
    tables: 8,
    levels: 14,
    initial: { smallBlind: 25, bigBlind: 50, ante: 0 },
    next: { smallBlind: 50, bigBlind: 100, ante: 0 },
  },
  {
    stageId: "national",
    totalPlayers: 85,
    tables: 15,
    levels: 16,
    initial: { smallBlind: 50, bigBlind: 100, ante: 0 },
    next: { smallBlind: 75, bigBlind: 150, ante: 0 },
  },
  {
    stageId: "world",
    totalPlayers: 275,
    tables: 46,
    levels: 20,
    initial: { smallBlind: 75, bigBlind: 150, ante: 0 },
    next: { smallBlind: 100, bigBlind: 200, ante: 0 },
  },
];

function entrantsFor(config) {
  return Array.from({ length: config.totalPlayers }, (_, index) => ({
    id: index === 0 ? "hero" : `cpu-${index}`,
    name: index === 0 ? "Hero" : `CPU ${index}`,
  }));
}

function completeTableHand(state, tableId, handIndex, seatResults = []) {
  return onTableHandCompleted(state, tableId, {
    handIndex,
    seatResults,
  });
}

function completeSynchronizedTableRound(state, handIndex) {
  let next = state;
  const activeTableIds = state.tables
    .filter((table) => table.isActive)
    .map((table) => table.tableId);
  activeTableIds.forEach((tableId) => {
    next = completeTableHand(next, tableId, handIndex);
  });
  return next;
}

function finishWithHeroChampion(state) {
  let next = state;
  let handIndex = 1;
  const opponentIds = Object.keys(next.players).filter((playerId) => playerId !== "hero");
  for (const opponentId of opponentIds) {
    const opponent = next.players[opponentId];
    if (!opponent || opponent.busted || !opponent.tableId) continue;
    next = completeTableHand(next, opponent.tableId, handIndex, [
      {
        seatIndex: opponent.seatIndex ?? 0,
        playerId: opponent.id,
        startingStack: opponent.stack,
        stack: 0,
      },
    ]);
    handIndex += 1;
    if (next.isFinished) break;
  }
  return next;
}

describe("canonical tournament stage blind progression", () => {
  it.each(STAGE_EXPECTATIONS)(
    "$stageId uses its production field size and advances only after five hands at every active table",
    ({ stageId, totalPlayers, tables, levels, initial, next }) => {
      const config = buildTournamentConfigFromStage(stageId);
      let state = createMTTTournamentState(config, entrantsFor(config));

      expect(config).toMatchObject({ stageId, totalPlayers, tables });
      expect(config.levels).toHaveLength(levels);
      expect(getCurrentLevel(state)).toMatchObject({
        levelIndex: 1,
        handsThisLevel: 5,
        ...initial,
      });

      for (let hand = 1; hand <= 4; hand += 1) {
        state = completeSynchronizedTableRound(state, hand);
        expect(state.levelIndex).toBe(0);
      }

      const activeTableIds = state.tables
        .filter((table) => table.isActive)
        .map((table) => table.tableId);
      for (const tableId of activeTableIds.slice(0, -1)) {
        state = completeTableHand(state, tableId, 5);
        expect(state.levelIndex).toBe(0);
      }

      state = completeTableHand(state, activeTableIds.at(-1), 5);
      expect(state.levelIndex).toBe(1);
      expect(getCurrentLevel(state)).toMatchObject({
        levelIndex: 2,
        handsThisLevel: 5,
        ...next,
      });
      expect(
        state.tables
          .filter((table) => table.isActive)
          .every((table) => table.handsPlayedAtThisLevel === 0),
      ).toBe(true);
    },
  );

  it("finishes the production-sized World Championship simulation with a champion and complete placements", () => {
    const config = buildTournamentConfigFromStage("world");
    let state = createMTTTournamentState(config, entrantsFor(config));
    let cycles = 0;

    while (!state.isFinished && cycles < 256) {
      state = simulateBackgroundTables(state, null, { maxHandsPerTable: 6 });
      cycles += 1;
    }

    expect(state.isFinished).toBe(true);
    expect(state.playersRemaining).toBe(1);
    expect(state.championId).toBeTruthy();
    expect(state.players[state.championId]).toMatchObject({ finishPlace: 1 });
    expect(state.finishOrder).toHaveLength(config.totalPlayers - 1);
    expect(state.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["FINAL_TABLE", "TOP_THREE", "HEADS_UP"]),
    );
  });

  it.each([
    ["store", 1_000, 0],
    ["local", 12_000, 1_000],
  ])(
    "finishes the production %s stage with Hero as champion and the configured cash result",
    (stageId, championPayout, entryFee) => {
      const config = buildTournamentConfigFromStage(stageId);
      const state = finishWithHeroChampion(
        createMTTTournamentState(config, entrantsFor(config)),
      );

      expect(config.entryFee).toBe(entryFee);
      expect(state).toMatchObject({
        isFinished: true,
        championId: "hero",
        playersRemaining: 1,
      });
      expect(state.players.hero).toMatchObject({
        finishPlace: 1,
        payout: championPayout,
      });
      expect(state.finishOrder).toHaveLength(config.totalPlayers - 1);
    },
  );

  it("expands Local payout ranges without dropping fourth through eighth place", () => {
    const config = buildTournamentConfigFromStage("local");

    expect(config.rewards).toEqual([
      expect.objectContaining({ place: 1, amount: 12_000 }),
      expect.objectContaining({ place: 2, amount: 7_500 }),
      expect.objectContaining({ place: 3, amount: 4_000 }),
      expect.objectContaining({ place: 4, amount: 2_200 }),
      expect.objectContaining({ place: 5, amount: 2_200 }),
      expect.objectContaining({ place: 6, amount: 1_000 }),
      expect.objectContaining({ place: 7, amount: 1_000 }),
      expect.objectContaining({ place: 8, amount: 1_000 }),
    ]);
    expect(config.prizePoolTotal).toBe(30_900);
  });

  it.each(STAGE_EXPECTATIONS)(
    "$stageId explicitly forbids re-entry at every level, including the final table",
    ({ stageId }) => {
      const config = buildTournamentConfigFromStage(stageId);
      expect(config.reentryPolicy).toEqual({
        allowed: false,
        maxEntries: 1,
        closesAtLevel: 0,
      });
    },
  );
});
