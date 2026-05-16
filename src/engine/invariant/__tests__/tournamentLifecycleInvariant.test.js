import { describe, expect, it } from "vitest";
import { assertTournamentLifecycleInvariant } from "../assertTournamentLifecycleInvariant.js";

describe("tournament lifecycle invariant", () => {
  it("passes completed tournament rows", () => {
    expect(assertTournamentLifecycleInvariant({ mode: "tournament", tournamentsCompleted: 1 })).toEqual([]);
  });

  it("flags incomplete tournaments", () => {
    expect(assertTournamentLifecycleInvariant({ mode: "tournament", tournamentsCompleted: 0 })[0].type).toBe(
      "TOURNAMENT_NOT_COMPLETED",
    );
  });
});

