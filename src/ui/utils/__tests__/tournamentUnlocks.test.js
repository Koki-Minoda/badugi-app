import { describe, expect, it } from "vitest";
import {
  evaluateTournamentUnlocks,
  formatUnlockRequirement,
  getUnlockForVariant,
} from "../../../config/tournamentUnlocks.js";

describe("tournament unlock evaluator", () => {
  it("keeps 2-7 locked with no progress", () => {
    const result = evaluateTournamentUnlocks({ completedTournaments: [] });

    expect(result.unlockedVariants).toContain("badugi");
    expect(result.unlockedVariants).not.toContain("2-7td");
  });

  it("unlocks 2-7 after a Badugi World championship", () => {
    const result = evaluateTournamentUnlocks({
      completedTournaments: [
        { variant: "badugi", stage: "world", finishPlace: 1 },
      ],
    });

    expect(result.unlockedVariants).toContain("2-7td");
  });

  it("keeps 2-7 locked after a Badugi National championship", () => {
    const result = evaluateTournamentUnlocks({
      completedTournaments: [
        { variant: "badugi", stage: "national", finishPlace: 1 },
      ],
    });

    expect(result.unlockedVariants).not.toContain("2-7td");
  });

  it("describes the next unlock requirement", () => {
    expect(formatUnlockRequirement(getUnlockForVariant("2-7td"))).toBe(
      "Win Badugi World Championship to unlock",
    );
  });
});
