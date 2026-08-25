import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_MTT_SAVE_KEY,
  ACTIVE_TOURNAMENT_SESSION_KEY,
  clearActiveTournamentSession,
  clearActiveMTTSnapshot,
  createMTTSaveSnapshot,
  isResumeableMTTSnapshot,
  loadActiveTournamentSession,
  loadActiveMTTSnapshot,
  saveActiveTournamentSession,
  saveActiveMTTSnapshot,
} from "../../tournament/tournamentManager.js";

const baseState = {
  config: {
    id: "store-mtt",
    name: "Store Tournament",
    stageId: "store",
    gameVariant: "badugi",
    seatsPerTable: 6,
    startingStack: 500,
    levels: [{ levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 5 }],
  },
  levelIndex: 0,
  playersRemaining: 17,
  totalPlayers: 18,
  players: {
    "hero-player": {
      id: "hero-player",
      name: "You",
      stack: 620,
      busted: false,
      tableId: "table-1",
      seatIndex: 0,
      finishPlace: null,
    },
    "cpu-1": {
      id: "cpu-1",
      name: "CPU 1",
      stack: 0,
      busted: true,
      tableId: null,
      seatIndex: null,
      finishPlace: 18,
    },
  },
  tables: [
    {
      tableId: "table-1",
      isActive: true,
      handsPlayedAtThisLevel: 2,
      seats: [
        { seatIndex: 0, playerId: "hero-player" },
        { seatIndex: 1, playerId: null },
      ],
    },
  ],
  isFinished: false,
  championId: null,
  finishOrder: ["cpu-1"],
  events: [],
  lastEvent: null,
};

describe("MTT save snapshot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearActiveTournamentSession();
    clearActiveMTTSnapshot();
    window.localStorage.clear();
  });

  it("saves hand-boundary tournament state to the active MTT key", () => {
    const snapshot = saveActiveMTTSnapshot({
      tournamentState: baseState,
      heroPlayerId: "hero-player",
      hud: {
        handsPlayedThisLevel: 2,
        handsThisLevel: 5,
        currentBlinds: { sb: 5, bb: 10, ante: 0 },
        currentLevelNumber: 1,
      },
      variantId: "badugi",
    });

    expect(window.localStorage.getItem(ACTIVE_MTT_SAVE_KEY)).toBeTruthy();
    expect(snapshot).toMatchObject({
      version: 1,
      stageId: "store",
      variantId: "badugi",
      hero: {
        playerId: "hero-player",
        tableId: "table-1",
        seatIndex: 0,
        stack: 620,
      },
      hud: {
        handsPlayedThisLevel: 2,
        handsThisLevel: 5,
        currentBlinds: { sb: 5, bb: 10, ante: 0 },
        currentLevelNumber: 1,
      },
    });
  });

  it("loads level, remaining players, tables, and busted players unchanged", () => {
    saveActiveMTTSnapshot({
      tournamentState: baseState,
      heroPlayerId: "hero-player",
      hud: { handsPlayedThisLevel: 2, handsThisLevel: 5 },
      variantId: "badugi",
    });

    const loaded = loadActiveMTTSnapshot();
    expect(loaded.tournamentState.levelIndex).toBe(0);
    expect(loaded.tournamentState.playersRemaining).toBe(17);
    expect(loaded.tournamentState.tables).toHaveLength(1);
    expect(loaded.tournamentState.players["cpu-1"]).toMatchObject({
      busted: true,
      finishPlace: 18,
    });
    expect(isResumeableMTTSnapshot(loaded)).toBe(true);
  });

  it("does not resume finished or hero-busted snapshots", () => {
    const finished = createMTTSaveSnapshot({
      tournamentState: { ...baseState, isFinished: true },
      heroPlayerId: "hero-player",
    });
    const heroBusted = createMTTSaveSnapshot({
      tournamentState: {
        ...baseState,
        players: {
          ...baseState.players,
          "hero-player": {
            ...baseState.players["hero-player"],
            stack: 0,
            busted: true,
          },
        },
      },
      heroPlayerId: "hero-player",
    });

    expect(isResumeableMTTSnapshot(finished)).toBe(false);
    expect(isResumeableMTTSnapshot(heroBusted)).toBe(false);
  });

  it("clears retired active MTT snapshots", () => {
    saveActiveMTTSnapshot({ tournamentState: baseState, heroPlayerId: "hero-player" });
    clearActiveMTTSnapshot();
    expect(loadActiveMTTSnapshot()).toBeNull();
  });

  it("returns null for corrupted active MTT snapshots", () => {
    window.localStorage.setItem(ACTIVE_MTT_SAVE_KEY, "{bad json");

    expect(() => loadActiveMTTSnapshot()).not.toThrow();
    expect(loadActiveMTTSnapshot()).toBeNull();
  });

  it("does not throw when active MTT snapshot storage reads fail", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => loadActiveMTTSnapshot()).not.toThrow();
    expect(loadActiveMTTSnapshot()).toBeNull();
  });

  it("warns and returns the snapshot when active MTT snapshot save fails", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    const snapshot = saveActiveMTTSnapshot({
      tournamentState: baseState,
      heroPlayerId: "hero-player",
    });

    expect(snapshot).toMatchObject({ version: 1, stageId: "store" });
    expect(warnSpy).toHaveBeenCalledWith("[TD2][SNAPSHOT_SAVE_FAILED]");
  });

  it("does not throw when active MTT snapshot remove fails", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("remove failed");
    });

    expect(() => clearActiveMTTSnapshot()).not.toThrow();
  });

  it("roundtrips active tournament sessions through the session snapshot key", () => {
    const session = {
      id: "session-1",
      stageId: "store",
      status: "active",
      remainingPlayers: 18,
    };

    saveActiveTournamentSession(session);

    expect(window.localStorage.getItem(ACTIVE_TOURNAMENT_SESSION_KEY)).toBeTruthy();
    expect(loadActiveTournamentSession()).toEqual(session);
  });
});
