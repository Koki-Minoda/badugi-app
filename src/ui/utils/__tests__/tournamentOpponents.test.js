import { describe, expect, it } from "vitest";
import {
  getTournamentOpponentForSeat,
  getTournamentOpponentProfile,
  getTournamentOpponentRosterForStage,
} from "../../../config/tournamentOpponents.js";

describe("tournament opponent profiles", () => {
  it("returns normalized opponent profiles for a stage roster", () => {
    const roster = getTournamentOpponentRosterForStage("store");
    expect(roster.length).toBeGreaterThan(0);
    expect(roster[0]).toMatchObject({
      stageId: "store",
      variantId: "badugi",
      tierId: "standard",
    });
    expect(roster[0].personalityId).toBeTruthy();
    expect(roster[0].personality.id).toBe(roster[0].personalityId);
    expect(Array.isArray(roster[0].traits)).toBe(true);
  });

  it("uses different rosters by tournament stage", () => {
    const storeOpponent = getTournamentOpponentForSeat("store", 0);
    const worldOpponent = getTournamentOpponentForSeat("world", 0);
    expect(storeOpponent.stageId).toBe("store");
    expect(worldOpponent.stageId).toBe("world");
    expect(storeOpponent.id).not.toBe(worldOpponent.id);
    expect(worldOpponent.tierId).toBe("worldmaster");
  });

  it("gives every CPU entrant in the production fields a distinct visible name", () => {
    for (const [stageId, cpuCount] of [["store", 17], ["local", 44], ["world", 274]]) {
      const names = Array.from({ length: cpuCount }, (_, seat) =>
        getTournamentOpponentForSeat(stageId, seat).displayName,
      );
      expect(new Set(names).size).toBe(names.length);
      if (stageId === "store") {
        expect(names[0]).toBe(getTournamentOpponentForSeat(stageId, 0).name);
        expect(names[5]).toBe(`${names[0]} 2`);
      }
    }
  });

  it("falls back safely for unknown profile ids and stages", () => {
    const unknownProfile = getTournamentOpponentProfile("missing-profile");
    expect(unknownProfile.id).toBe("unknown-rival");
    expect(unknownProfile.personalityId).toBe("balanced");

    const unknownStage = getTournamentOpponentRosterForStage("missing-stage");
    expect(unknownStage).toHaveLength(1);
    expect(unknownStage[0].id).toBe("unknown-rival");
  });
});
