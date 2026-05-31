import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSOLIDATED_TOURNAMENT_PROGRESS_KEY,
  createDefaultConsolidatedProgress,
  detectLegacyProgressDrift,
  loadConsolidatedProgress,
  migrateLegacyProgressToV2,
  recordConsolidatedTournamentResult,
  saveConsolidatedProgress,
} from "../consolidatedProgress.js";

const LEGACY_TOURNAMENT_PROGRESS_KEY = "progress.tournament";
const LEGACY_TOURNAMENT_HISTORY_KEY = "history.tournaments";
const LEGACY_PLAYER_PROGRESS_KEY = "playerProgress";
const LEGACY_CAREER_PROFILE_KEY = "mgx.career.profile";
const LEGACY_RIVAL_HISTORY_KEY = "mgx.career.rivals";

function setJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

describe("consolidated tournament progress v2", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("creates the default v2 schema", () => {
    const progress = createDefaultConsolidatedProgress();

    expect(progress).toMatchObject({
      version: 2,
      tournament: {
        bankroll: 0,
        stageWins: { store: 0, local: 0, national: 0, world: 0 },
        completedTournaments: [],
        lastResult: null,
        history: [],
      },
      career: {
        unlockedVariants: ["badugi"],
        statistics: {
          tournamentsPlayed: 0,
          tournamentsWon: 0,
          finalTables: 0,
          headsUps: 0,
          totalPrize: 0,
        },
        worldChampionship: {
          cleared: false,
          firstClearTimestamp: null,
          clearCount: 0,
          lastUnlockPopupAt: null,
        },
      },
      rivals: {},
      _meta: {
        migratedFrom: [],
        migratedAt: null,
        legacyKeysRetained: true,
      },
    });
  });

  it("saves and loads v2 progress roundtrip", () => {
    const saved = saveConsolidatedProgress({
      ...createDefaultConsolidatedProgress(),
      tournament: {
        ...createDefaultConsolidatedProgress().tournament,
        bankroll: 250,
        stageWins: { store: 2, local: 1, national: 0, world: 0 },
      },
    });

    expect(saved.tournament.bankroll).toBe(250);
    expect(loadConsolidatedProgress().tournament.stageWins).toMatchObject({
      store: 2,
      local: 1,
    });
  });

  it("returns default when v2 JSON is corrupted", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.localStorage.setItem(CONSOLIDATED_TOURNAMENT_PROGRESS_KEY, "{bad json");

    expect(loadConsolidatedProgress()).toMatchObject(
      createDefaultConsolidatedProgress(),
    );
    expect(warnSpy).toHaveBeenCalled();
  });

  it("migrates stage wins from progress.tournament and playerProgress using max values", () => {
    setJson(LEGACY_TOURNAMENT_PROGRESS_KEY, {
      wins: { store: 1, local: 3, national: 0, world: 0 },
    });
    setJson(LEGACY_PLAYER_PROGRESS_KEY, {
      stageWins: { store: 4, local: 1, national: 2, world: 0 },
    });

    const migrated = migrateLegacyProgressToV2();

    expect(migrated.tournament.stageWins).toEqual({
      store: 4,
      local: 3,
      national: 2,
      world: 0,
    });
    expect(migrated._meta.migratedFrom).toEqual(
      expect.arrayContaining([
        LEGACY_TOURNAMENT_PROGRESS_KEY,
        LEGACY_PLAYER_PROGRESS_KEY,
      ]),
    );
  });

  it("deduplicates completed tournaments from tournament and career legacy sources", () => {
    const duplicate = {
      variant: "badugi",
      stage: "world",
      finishPlace: 1,
      tournamentId: "world-mtt",
      completedAt: 123,
    };
    setJson(LEGACY_TOURNAMENT_PROGRESS_KEY, {
      completedTournaments: [duplicate],
    });
    setJson(LEGACY_CAREER_PROFILE_KEY, {
      completedTournaments: [
        duplicate,
        {
          variant: "badugi",
          stageId: "store",
          placement: 2,
          tournamentId: "store-mtt",
          finishedAt: 456,
        },
      ],
    });

    const migrated = migrateLegacyProgressToV2();

    expect(migrated.tournament.completedTournaments).toHaveLength(2);
    expect(migrated.tournament.completedTournaments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "world", finishPlace: 1 }),
        expect.objectContaining({ stage: "store", finishPlace: 2 }),
      ]),
    );
  });

  it("migrates world champion clear and rivals", () => {
    setJson(LEGACY_PLAYER_PROGRESS_KEY, {
      worldChampCleared: true,
      firstClearTimestamp: 111,
      clearCount: 2,
      lastUnlockPopupAt: 222,
    });
    setJson(LEGACY_RIVAL_HISTORY_KEY, {
      rivals: {
        "store-satoru": {
          handsPlayed: 12,
          tournamentsMet: 1,
          heroWins: 1,
        },
      },
    });

    const migrated = migrateLegacyProgressToV2();

    expect(migrated.career.worldChampionship).toMatchObject({
      cleared: true,
      firstClearTimestamp: 111,
      clearCount: 2,
      lastUnlockPopupAt: 222,
    });
    expect(migrated.rivals["store-satoru"]).toMatchObject({
      opponentId: "store-satoru",
      handsPlayed: 12,
      tournamentsMet: 1,
      heroWins: 1,
    });
  });

  it("records tournament results into v2 stage wins, statistics, completed list, and history", () => {
    recordConsolidatedTournamentResult({
      variant: "badugi",
      stageId: "store",
      finishPlace: 1,
      prize: 100,
      tournamentId: "store-mtt",
      completedAt: 1234567890,
      finalTables: 1,
      headsUps: 0,
    });

    const progress = loadConsolidatedProgress();
    expect(progress.tournament.stageWins.store).toBe(1);
    expect(progress.tournament.completedTournaments).toHaveLength(1);
    expect(progress.tournament.lastResult).toMatchObject({
      stageId: "store",
      finishPlace: 1,
      prize: 100,
    });
    expect(progress.tournament.history).toHaveLength(1);
    expect(progress.career.statistics).toMatchObject({
      tournamentsPlayed: 1,
      tournamentsWon: 1,
      finalTables: 1,
      headsUps: 0,
      totalPrize: 100,
    });
  });

  it("marks world championship as cleared from a v2 world win", () => {
    recordConsolidatedTournamentResult({
      variant: "badugi",
      stageId: "world",
      finishPlace: 1,
      tournamentId: "world-mtt",
      completedAt: 500,
    });

    expect(loadConsolidatedProgress().career.worldChampionship).toMatchObject({
      cleared: true,
      firstClearTimestamp: 500,
      clearCount: 1,
    });
  });

  it("warns when legacy progress drifts from v2", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    setJson(LEGACY_TOURNAMENT_PROGRESS_KEY, {
      wins: { store: 1, local: 0, national: 0, world: 0 },
      completedTournaments: [
        {
          variant: "badugi",
          stage: "store",
          finishPlace: 1,
          tournamentId: "store-mtt",
          completedAt: 100,
        },
      ],
    });
    setJson(LEGACY_CAREER_PROFILE_KEY, {
      statistics: { tournamentsPlayed: 1 },
    });
    saveConsolidatedProgress(createDefaultConsolidatedProgress());

    const drift = detectLegacyProgressDrift();

    expect(drift).toMatchObject({
      stageWins: { store: { legacy: 1, v2: 0 } },
      completedTournamentsLength: { legacy: 1, v2: 0 },
      statistics: { tournamentsPlayed: { legacy: 1, v2: 0 } },
    });
    expect(warnSpy).toHaveBeenCalledWith("[TD1][PROGRESS-DRIFT]", drift);
  });

  it("migrates tournament history and career statistics", () => {
    setJson(LEGACY_TOURNAMENT_HISTORY_KEY, [
      { id: "h1", stageId: "store", placement: 1, prize: 100, timestamp: 300 },
    ]);
    setJson(LEGACY_CAREER_PROFILE_KEY, {
      achievements: [{ id: "champion-badugi-store", stage: "store" }],
      statistics: {
        tournamentsPlayed: 3,
        tournamentsWon: 1,
        finalTables: 2,
        headsUps: 1,
        totalPrize: 500,
      },
    });

    const migrated = migrateLegacyProgressToV2();

    expect(migrated.tournament.history).toHaveLength(1);
    expect(migrated.career.statistics).toMatchObject({
      tournamentsPlayed: 3,
      tournamentsWon: 1,
      finalTables: 2,
      headsUps: 1,
      totalPrize: 500,
    });
    expect(migrated.career.achievements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "champion-badugi-store" }),
      ]),
    );
  });
});
