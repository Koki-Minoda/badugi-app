import { afterEach, describe, expect, it } from "vitest";
import {
  appendTournamentHistory,
  applyTournamentResult,
  getTournamentHistory,
  loadTournamentProgress,
  resetTournamentProgress,
  saveTournamentProgress,
} from "../tournamentState.js";
import { STORAGE_KEYS } from "../../../storage/keys.js";

describe("tournament progress state", () => {
  afterEach(() => {
    resetTournamentProgress();
    window.localStorage.clear();
  });

  it("loads default tournament progress through storage fallback", () => {
    expect(loadTournamentProgress()).toMatchObject({
      bankroll: 0,
      wins: { store: 0, local: 0, national: 0, world: 0 },
      completedTournaments: [],
      lastResult: null,
    });
  });

  it("saves and loads tournament progress through storage", () => {
    saveTournamentProgress({
      bankroll: 500,
      wins: { store: 2 },
      completedTournaments: [{ stage: "store", finishPlace: 1 }],
    });

    expect(loadTournamentProgress()).toMatchObject({
      bankroll: 500,
      wins: { store: 2, local: 0, national: 0, world: 0 },
      completedTournaments: [expect.objectContaining({ stage: "store" })],
    });
  });

  it("resetTournamentProgress removes the legacy progress key", () => {
    saveTournamentProgress({ bankroll: 200 });
    expect(window.localStorage.getItem(STORAGE_KEYS.TOURNAMENT_PROGRESS)).toBeTruthy();

    resetTournamentProgress();

    expect(window.localStorage.getItem(STORAGE_KEYS.TOURNAMENT_PROGRESS)).toBeNull();
  });

  it("keeps tournament history capped at 200 entries", () => {
    for (let index = 0; index < 205; index += 1) {
      appendTournamentHistory({ id: `history-${index}`, stageId: "store" });
    }

    expect(getTournamentHistory()).toHaveLength(200);
  });

  it("falls back safely when tournament progress storage is corrupted", () => {
    window.localStorage.setItem(STORAGE_KEYS.TOURNAMENT_PROGRESS, "{bad json");

    expect(() => loadTournamentProgress()).not.toThrow();
    expect(loadTournamentProgress()).toMatchObject({
      bankroll: 0,
      wins: { store: 0, local: 0, national: 0, world: 0 },
    });
  });

  it("records completed tournament results for unlock evaluation", () => {
    applyTournamentResult({
      variant: "badugi",
      stageId: "world",
      placement: 1,
      prize: 1000,
      tournamentId: "world-mtt",
    });

    const progress = loadTournamentProgress();
    expect(progress.completedTournaments).toEqual([
      expect.objectContaining({
        variant: "badugi",
        stage: "world",
        finishPlace: 1,
        tournamentId: "world-mtt",
      }),
    ]);
    expect(progress.wins.world).toBe(1);
  });
});
