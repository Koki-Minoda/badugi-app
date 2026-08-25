import { afterEach, describe, expect, it } from "vitest";
import {
  RIVAL_HISTORY_KEY,
  getRivalHistoryEntry,
  loadRivalHistory,
  recordRivalHandPlayed,
  recordRivalTournamentMet,
  recordRivalTournamentResult,
  saveRivalHistory,
} from "../rivalHistory.js";

describe("rivalHistory", () => {
  afterEach(() => {
    window.localStorage.removeItem(RIVAL_HISTORY_KEY);
  });

  it("creates an empty local rival history profile", () => {
    expect(loadRivalHistory()).toEqual({
      version: 1,
      rivals: {},
    });
  });

  it("saves and loads rival history through storage", () => {
    saveRivalHistory({
      rivals: {
        "store-satoru": {
          handsPlayed: 4,
          tournamentsMet: 2,
        },
      },
    });

    expect(loadRivalHistory().rivals["store-satoru"]).toMatchObject({
      opponentId: "store-satoru",
      handsPlayed: 4,
      tournamentsMet: 2,
    });
  });

  it("falls back to an empty profile for corrupted storage JSON", () => {
    window.localStorage.setItem(RIVAL_HISTORY_KEY, "{bad json");

    expect(loadRivalHistory()).toEqual({
      version: 1,
      rivals: {},
    });
  });

  it("does not throw for schema-invalid rival history payloads", () => {
    window.localStorage.setItem(
      RIVAL_HISTORY_KEY,
      JSON.stringify({ version: 1, rivals: "invalid" }),
    );

    expect(() => loadRivalHistory()).not.toThrow();
    expect(loadRivalHistory()).toEqual({
      version: 1,
      rivals: {},
    });
  });

  it("records tournament meetings and hands played by opponent id", () => {
    recordRivalTournamentMet(["store-satoru", "store-satoru", "store-miyu"]);
    recordRivalHandPlayed(["store-satoru"]);

    expect(getRivalHistoryEntry("store-satoru")).toMatchObject({
      opponentId: "store-satoru",
      tournamentsMet: 1,
      handsPlayed: 1,
    });
    expect(getRivalHistoryEntry("store-miyu").tournamentsMet).toBe(1);
  });

  it("tracks hero and opponent tournament wins", () => {
    recordRivalTournamentResult(["world-scarlet"], true);
    recordRivalTournamentResult(["world-scarlet"], false);

    expect(getRivalHistoryEntry("world-scarlet")).toMatchObject({
      heroWins: 1,
      opponentWins: 1,
    });
  });
});
