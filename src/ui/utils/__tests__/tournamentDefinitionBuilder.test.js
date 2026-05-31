import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STORE_STANDARD_BLIND_LEVELS } from "../../../config/tournamentBlindSheets.js";
import { buildTournamentConfigFromStage } from "../../../config/tournamentStages.js";

describe("TournamentDefinition builder", () => {
  it("builds the current Store MTT config from the store stage definition", () => {
    const config = buildTournamentConfigFromStage("store");

    expect(config).toMatchObject({
      id: "store-mtt",
      name: "Store Tournament",
      stageId: "store",
      blindSheetId: "store-standard",
      tables: 3,
      seatsPerTable: 6,
      totalPlayers: 18,
      startingStack: 500,
      gameId: "D03",
      gameVariant: "badugi",
      gameRotation: ["badugi"],
      rotationPolicy: "fixed",
      payouts: [
        { place: 1, percent: 50 },
        { place: 2, percent: 30 },
        { place: 3, percent: 20 },
      ],
    });
    expect(config.levels).toBe(STORE_STANDARD_BLIND_LEVELS);
  });

  it("builds Store config with the 15-level blind sheet and no Level3 999 escape", () => {
    const config = buildTournamentConfigFromStage("store");

    expect(config.levels).toHaveLength(15);
    expect(config.levels[2]).toMatchObject({
      levelIndex: 3,
      smallBlind: 20,
      bigBlind: 40,
      ante: 2,
      handsThisLevel: 5,
    });
    expect(config.levels[2].handsThisLevel).not.toBe(999);
  });

  it("keeps App default Store tournament config sourced from the stage builder", () => {
    const appSource = readFileSync(
      join(process.cwd(), "src/ui/App.jsx"),
      "utf8",
    );

    expect(appSource).toContain(
      'const DEFAULT_STORE_TOURNAMENT_CONFIG = buildTournamentConfigFromStage("store");',
    );
  });
});
