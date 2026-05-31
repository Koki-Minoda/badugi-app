import { afterEach, describe, expect, it } from "vitest";
import {
  CAREER_PROFILE_KEY,
  buildCareerProgressMap,
  buildCareerViewModel,
  createDefaultCareerProfile,
  loadCareerProfile,
  recordCareerTournamentResult,
  resetCareerProfile,
  saveCareerProfile,
} from "../careerProfile.js";

describe("career profile", () => {
  afterEach(() => {
    window.localStorage.removeItem(CAREER_PROFILE_KEY);
  });

  it("creates the default career profile", () => {
    const profile = createDefaultCareerProfile();

    expect(profile).toMatchObject({
      version: 1,
      unlockedVariants: ["badugi"],
      completedTournaments: [],
      achievements: [],
      statistics: {
        tournamentsPlayed: 0,
        tournamentsWon: 0,
        finalTables: 0,
        headsUps: 0,
        totalPrize: 0,
      },
    });
  });

  it("saves and loads the career profile", () => {
    saveCareerProfile({
      ...createDefaultCareerProfile(),
      statistics: { tournamentsPlayed: 2, totalPrize: 1200 },
    });

    expect(window.localStorage.getItem(CAREER_PROFILE_KEY)).toBeTruthy();
    expect(loadCareerProfile().statistics).toMatchObject({
      tournamentsPlayed: 2,
      totalPrize: 1200,
    });
  });

  it("records Store, Local, and World champion progress", () => {
    resetCareerProfile();

    recordCareerTournamentResult({
      variant: "badugi",
      stageId: "store",
      finishPlace: 1,
      prize: 1000,
      completedAt: 100,
    });
    recordCareerTournamentResult({
      variant: "badugi",
      stageId: "local",
      finishPlace: 1,
      prize: 2000,
      completedAt: 200,
    });
    const profile = recordCareerTournamentResult({
      variant: "badugi",
      stageId: "world",
      finishPlace: 1,
      prize: 5000,
      completedAt: 300,
    });

    const progressMap = buildCareerProgressMap(profile);
    expect(progressMap.find((stage) => stage.stageId === "store").champion).toBe(true);
    expect(progressMap.find((stage) => stage.stageId === "local").champion).toBe(true);
    expect(progressMap.find((stage) => stage.stageId === "world").champion).toBe(true);
    expect(profile.statistics).toMatchObject({
      tournamentsPlayed: 3,
      tournamentsWon: 3,
      finalTables: 3,
      headsUps: 3,
      totalPrize: 8000,
    });
  });

  it("unlocks 2-7 after a Badugi World championship", () => {
    resetCareerProfile();

    const profile = recordCareerTournamentResult({
      variant: "badugi",
      stageId: "world",
      finishPlace: 1,
      completedAt: 400,
    });

    expect(profile.unlockedVariants).toContain("2-7td");
    expect(buildCareerViewModel(profile).variants).toContainEqual(
      expect.objectContaining({ id: "2-7td", playable: true }),
    );
  });
});
