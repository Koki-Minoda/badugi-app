import { describe, it, expect } from "vitest";
import {
  attachVariantLabelsToHud,
  buildTournamentHudPayload,
} from "../tournamentHudUtils.js";

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
