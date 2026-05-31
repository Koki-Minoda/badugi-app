import { describe, it, expect } from "vitest";
import {
  applyActualBlindDisplayToHud,
  attachVariantLabelsToHud,
  buildTournamentHudPayload,
  resolveHandsPlayedThisLevel,
} from "../tournamentHudUtils.js";
import { STORE_STANDARD_BLIND_LEVELS } from "../../../config/tournamentBlindSheets.js";

const baseConfig = {
  seatsPerTable: 6,
  payouts: [
    { place: 1, percent: 50 },
    { place: 2, percent: 30 },
    { place: 3, percent: 20 },
  ],
  levels: [
    { levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 5 },
    { levelIndex: 2, smallBlind: 10, bigBlind: 20, ante: 1, handsThisLevel: 5 },
  ],
};

function createState(overrides = {}) {
  return {
    config: baseConfig,
    playersRemaining: 12,
    totalPlayers: 18,
    levelIndex: 0,
    tables: [
      { tableId: "table-1", isActive: true },
      { tableId: "table-2", isActive: true },
    ],
    ...overrides,
  };
}

describe("tournamentHudUtils", () => {
  it("reflects hero seat and table changes in the payload", () => {
    const heroAtTableOne = { tableId: "table-1", seatIndex: 2 };
    const payloadOne = buildTournamentHudPayload({
      state: createState(),
      heroPlayer: heroAtTableOne,
    });
    expect(payloadOne.heroPositionText).toContain("Table 1");
    expect(payloadOne.heroPositionText).toContain("Seat 3");

    const heroMoved = { tableId: "table-2", seatIndex: 0 };
    const payloadTwo = buildTournamentHudPayload({
      state: createState(),
      heroPlayer: heroMoved,
    });
    expect(payloadTwo.heroPositionText).toContain("Table 2");
    expect(payloadTwo.heroPositionText).toContain("Seat 1");
  });

  it("marks final table state when only one table remains", () => {
    const finalState = createState({
      playersRemaining: 6,
      tables: [{ tableId: "table-1", isActive: true }],
    });
    const hero = { tableId: "table-1", seatIndex: 4 };
    const payload = buildTournamentHudPayload({ state: finalState, heroPlayer: hero });
    expect(payload.tablesActiveText).toBe("Tables: Final");
    expect(payload.heroPositionText).toContain("Final");
    expect(payload.isFinalTable).toBe(true);
    expect(payload.playersRemaining).toBe(6);
    expect(payload.totalPlayers).toBe(18);
    expect(payload.totalEntrants).toBe(18);
    expect(payload.payoutBreakdown).toHaveLength(3);
  });

  it("formats TABLE_MERGE tournament event status without changing core counters", () => {
    const payload = buildTournamentHudPayload({
      state: createState({
        playersRemaining: 12,
        tables: [
          { tableId: "table-1", isActive: true, handsPlayedAtThisLevel: 2 },
          { tableId: "table-2", isActive: true, handsPlayedAtThisLevel: 1 },
          { tableId: "table-3", isActive: false, handsPlayedAtThisLevel: 0 },
        ],
        lastEvent: {
          type: "TABLE_MERGE",
          fromTables: 3,
          toTables: 2,
          playersRemaining: 12,
        },
      }),
      heroPlayer: { tableId: "table-1", seatIndex: 0 },
    });

    expect(payload.tournamentEventText).toBe("TABLE MERGE: 12 players / 2 tables");
    expect(payload.tablesActiveText).toBe("Tables: 2");
    expect(payload.playersRemaining).toBe(12);
    expect(payload.currentBlinds).toEqual({ sb: 5, bb: 10, ante: 0 });
    expect(payload.handsPlayedThisLevel).toBe(2);
    expect(payload.handsThisLevel).toBe(5);
  });

  it("formats FINAL_TABLE tournament event status", () => {
    const payload = buildTournamentHudPayload({
      state: createState({
        playersRemaining: 6,
        tables: [{ tableId: "table-1", isActive: true, handsPlayedAtThisLevel: 1 }],
        lastEvent: {
          type: "FINAL_TABLE",
          fromTables: 2,
          toTables: 1,
          playersRemaining: 6,
        },
      }),
      heroPlayer: { tableId: "table-1", seatIndex: 0 },
    });

    expect(payload.tournamentEventText).toBe("FINAL TABLE");
    expect(payload.tablesActiveText).toBe("Tables: Final");
    expect(payload.isFinalTable).toBe(true);
  });

  it("formats HEADS_UP tournament event status", () => {
    const payload = buildTournamentHudPayload({
      state: createState({
        playersRemaining: 2,
        tables: [{ tableId: "table-1", isActive: true, handsPlayedAtThisLevel: 3 }],
        events: [{ type: "HEADS_UP", playersRemaining: 2, tablesActive: 1 }],
      }),
      heroPlayer: { tableId: "table-1", seatIndex: 1 },
    });

    expect(payload.tournamentEventText).toBe("HEADS-UP");
    expect(payload.tablesActiveText).toBe("HEADS-UP");
    expect(payload.playersRemaining).toBe(2);
  });

  it("formats MONEY_BUBBLE and TOP_THREE milestone event status", () => {
    const bubblePayload = buildTournamentHudPayload({
      state: createState({
        playersRemaining: 4,
        tables: [{ tableId: "table-1", isActive: true, handsPlayedAtThisLevel: 2 }],
        lastEvent: { type: "MONEY_BUBBLE", playersRemaining: 4, paidPlaces: 3 },
      }),
      heroPlayer: { tableId: "table-1", seatIndex: 0 },
    });
    expect(bubblePayload.tournamentEventText).toBe("MONEY BUBBLE");
    expect(bubblePayload.tournamentTimeline.map((item) => item.value)).toEqual([
      18,
      12,
      6,
      3,
      2,
      1,
    ]);

    const topThreePayload = buildTournamentHudPayload({
      state: createState({
        playersRemaining: 3,
        tables: [{ tableId: "table-1", isActive: true, handsPlayedAtThisLevel: 3 }],
        lastEvent: { type: "TOP_THREE", playersRemaining: 3 },
      }),
      heroPlayer: { tableId: "table-1", seatIndex: 0 },
    });
    expect(topThreePayload.tournamentEventText).toBe("FINAL 3");
    expect(topThreePayload.tournamentTimeline.find((item) => item.value === 3)?.active).toBe(true);
  });

  it("computes average stack and level info", () => {
    const state = createState({
      players: {
        a: { id: "a", stack: 5000, busted: false },
        b: { id: "b", stack: 4000, busted: false },
        c: { id: "c", stack: 0, busted: true },
      },
      tables: [
        { tableId: "table-1", isActive: true, handsPlayedAtThisLevel: 2 },
        { tableId: "table-2", isActive: true, handsPlayedAtThisLevel: 1 },
      ],
      levelIndex: 0,
    });
    const hero = { tableId: "table-1", seatIndex: 0 };
    const payload = buildTournamentHudPayload({ state, heroPlayer: hero });
    expect(payload.averageStack).toBeGreaterThan(0);
    expect(payload.currentBlinds.sb).toBe(5);
    expect(payload.handsPlayedThisLevel).toBe(2);
    expect(payload.handsThisLevel).toBe(5);
  });

  it("keeps canonical remaining and entrant counts after a CPU bust", () => {
    const players = Object.fromEntries(
      Array.from({ length: 18 }, (_, idx) => [
        `player-${idx + 1}`,
        { id: `player-${idx + 1}`, stack: 500, busted: false },
      ]),
    );
    const payload = buildTournamentHudPayload({
      state: createState({
        config: { ...baseConfig, tables: 3 },
        players,
        playersRemaining: 17,
        totalPlayers: 18,
      }),
      heroPlayer: { tableId: "table-1", seatIndex: 0 },
    });

    expect(payload.playersRemaining).toBe(17);
    expect(payload.totalEntrants).toBe(18);
    expect(payload.playersRemainingText).toBe("Players Remaining: 17 / 18");
  });

  it("HANDS-001 resolveHandsPlayedThisLevel returns appCounter when engine reports 0", () => {
    expect(resolveHandsPlayedThisLevel(0, 1)).toBe(1);
    expect(resolveHandsPlayedThisLevel(0, 3)).toBe(3);
    expect(resolveHandsPlayedThisLevel(0, 0)).toBe(0);
  });

  it("HANDS-002 resolveHandsPlayedThisLevel prefers positive engine value over fallback", () => {
    expect(resolveHandsPlayedThisLevel(3, 0)).toBe(3);
    expect(resolveHandsPlayedThisLevel(2, 5)).toBe(2);
  });

  it("HANDS-003 resolveHandsPlayedThisLevel falls back when engine is null or undefined", () => {
    expect(resolveHandsPlayedThisLevel(null, 4)).toBe(4);
    expect(resolveHandsPlayedThisLevel(undefined, 4)).toBe(4);
  });

  it("uses the actual blind level for HUD display when tournament state is stale", () => {
    const payload = buildTournamentHudPayload({
      state: createState({ levelIndex: 0 }),
      heroPlayer: { tableId: "table-1", seatIndex: 0 },
    });

    const displayed = applyActualBlindDisplayToHud(payload, {
      blindLevelIndex: 1,
      blindStructure: [
        { level: 1, sb: 5, bb: 10, ante: 0, hands: 5 },
        { level: 2, sb: 10, bb: 20, ante: 1, hands: 5 },
      ],
    });

    expect(displayed.levelLabel).toBe("Level 2  10/20 (Ante 1)");
    expect(displayed.currentLevelNumber).toBe(2);
    expect(displayed.currentBlinds).toEqual({ sb: 10, bb: 20, ante: 1 });
  });

  it("keeps player counts while overriding stale blind display", () => {
    const payload = buildTournamentHudPayload({
      state: createState({
        playersRemaining: 17,
        totalPlayers: 18,
        levelIndex: 0,
      }),
      heroPlayer: { tableId: "table-1", seatIndex: 0 },
    });

    const displayed = applyActualBlindDisplayToHud(payload, {
      blindLevelIndex: 1,
      blindStructure: [
        { levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0 },
        { levelIndex: 2, smallBlind: 10, bigBlind: 20, ante: 1 },
      ],
    });

    expect(displayed.playersRemaining).toBe(17);
    expect(displayed.totalEntrants).toBe(18);
    expect(displayed.playersRemainingText).toBe("Players Remaining: 17 / 18");
    expect(displayed.currentBlinds).toEqual({ sb: 10, bb: 20, ante: 1 });
  });

  it("BLIND-LEVEL-001 HUD shows level2 blinds when levelIndex=1 in nextState", () => {
    const blindStructure = [
      { levelNumber: 1, smallBlind: 5, bigBlind: 10, ante: 0 },
      { levelNumber: 2, smallBlind: 10, bigBlind: 20, ante: 1 },
    ];
    const stalePayload = buildTournamentHudPayload({
      state: createState({ levelIndex: 0 }),
      heroPlayer: { tableId: "table-1", seatIndex: 0 },
    });

    const updated = applyActualBlindDisplayToHud(stalePayload, {
      blindStructure,
      blindLevelIndex: 1,
    });

    expect(updated.currentBlinds.sb).toBe(10);
    expect(updated.currentBlinds.bb).toBe(20);
    expect(updated.currentLevelNumber).toBe(2);
  });

  it("BLIND-LEVEL-002 HUD level matches state.levelIndex when no levelChanged detected", () => {
    const blindStructure = [
      { levelNumber: 1, smallBlind: 5, bigBlind: 10, ante: 0 },
      { levelNumber: 2, smallBlind: 10, bigBlind: 20, ante: 1 },
      { levelNumber: 3, smallBlind: 20, bigBlind: 40, ante: 2 },
    ];

    const payload = applyActualBlindDisplayToHud(
      { currentBlinds: { sb: 5, bb: 10, ante: 0 } },
      { blindStructure, blindLevelIndex: 2 },
    );

    expect(payload.currentBlinds.sb).toBe(20);
    expect(payload.currentBlinds.bb).toBe(40);
  });

  it("STORE-BLINDS-001 store blind sheet defines 15 explicit five-hand levels", () => {
    expect(STORE_STANDARD_BLIND_LEVELS).toHaveLength(15);
    STORE_STANDARD_BLIND_LEVELS.forEach((blindLevel, index) => {
      expect(blindLevel.levelIndex).toBe(index + 1);
      expect(Number.isFinite(blindLevel.smallBlind)).toBe(true);
      expect(Number.isFinite(blindLevel.bigBlind)).toBe(true);
      expect(Number.isFinite(blindLevel.ante)).toBe(true);
      expect(blindLevel.handsThisLevel).toBe(5);
    });
  });

  it("STORE-BLINDS-002 HUD reflects store levels 1 through 4", () => {
    const config = { ...baseConfig, levels: STORE_STANDARD_BLIND_LEVELS };
    const heroPlayer = { tableId: "table-1", seatIndex: 0 };
    const expectedLevels = [
      { levelIndex: 0, levelNumber: 1, sb: 5, bb: 10, ante: 0 },
      { levelIndex: 1, levelNumber: 2, sb: 10, bb: 20, ante: 1 },
      { levelIndex: 2, levelNumber: 3, sb: 20, bb: 40, ante: 2 },
      { levelIndex: 3, levelNumber: 4, sb: 30, bb: 60, ante: 3 },
    ];

    expectedLevels.forEach(({ levelIndex, levelNumber, sb, bb, ante }) => {
      const payload = buildTournamentHudPayload({
        state: createState({ config, levelIndex }),
        heroPlayer,
      });

      expect(payload.currentLevelNumber).toBe(levelNumber);
      expect(payload.currentBlinds).toEqual({ sb, bb, ante });
      expect(payload.handsThisLevel).toBe(5);
    });
  });

  it("STORE-BLINDS-003 level3 HUD does not show H1/999", () => {
    const config = { ...baseConfig, levels: STORE_STANDARD_BLIND_LEVELS };
    const payload = buildTournamentHudPayload({
      state: createState({
        config,
        levelIndex: 2,
        tables: [
          { tableId: "table-1", isActive: true, handsPlayedAtThisLevel: 1 },
          { tableId: "table-2", isActive: true, handsPlayedAtThisLevel: 1 },
        ],
      }),
      heroPlayer: { tableId: "table-1", seatIndex: 0 },
    });

    expect(payload.currentLevelNumber).toBe(3);
    expect(payload.handsPlayedThisLevel).toBe(1);
    expect(payload.handsThisLevel).toBe(5);
    expect(`${payload.handsPlayedThisLevel}/${payload.handsThisLevel}`).not.toBe("1/999");
  });

  it("PLAYERS-REMAINING-004 HUD shows correct count using state.playersRemaining as SOT", () => {
    // Simulate the regression: state says 15 but tournamentHudState still carries 18
    const stateWith15 = {
      config: { ...baseConfig, tables: 3 },
      playersRemaining: 15,
      totalPlayers: 18,
      levelIndex: 0,
      tables: [
        { tableId: "table-1", isActive: true, handsPlayedAtThisLevel: 1 },
        { tableId: "table-2", isActive: true, handsPlayedAtThisLevel: 1 },
        { tableId: "table-3", isActive: true, handsPlayedAtThisLevel: 1 },
      ],
      players: Object.fromEntries(
        Array.from({ length: 18 }, (_, idx) => [
          `player-${idx + 1}`,
          { id: `player-${idx + 1}`, stack: idx < 3 ? 0 : 400, busted: idx < 3 },
        ]),
      ),
    };
    const heroPlayer = { tableId: "table-1", seatIndex: 0 };
    const payload = buildTournamentHudPayload({ state: stateWith15, heroPlayer });

    // buildTournamentHudPayload must use state.playersRemaining (15), not alivePlayers fallback
    expect(payload.playersRemaining).toBe(15);
    expect(payload.totalEntrants).toBe(18);
    expect(payload.playersRemainingText).toBe("Players Remaining: 15 / 18");
  });

  it("attaches variant labels without mutating payload", () => {
    const basePayload = {
      levelLabel: "Level 1  5/10 (Ante 0)",
      playersRemainingText: "Players Remaining: 12 / 18",
      tablesActiveText: "Tables: 2",
      heroPositionText: "Table 1  Seat 3",
      isFinalTable: false,
    };
    const merged = attachVariantLabelsToHud(basePayload, {
      currentVariantLabel: "Badugi",
      nextVariantLabel: "No-Limit Hold'em",
    });
    expect(merged.currentVariantLabel).toBe("Badugi");
    expect(merged.nextVariantLabel).toBe("No-Limit Hold'em");
    expect(basePayload.currentVariantLabel).toBeUndefined();
  });
});
