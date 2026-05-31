import { afterEach, describe, expect, it } from "vitest";
import {
  applyTournamentResult,
  loadTournamentProgress,
  resetTournamentProgress,
} from "../tournamentState.js";

describe("tournament progress state", () => {
  afterEach(() => {
    resetTournamentProgress();
    window.localStorage.clear();
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
