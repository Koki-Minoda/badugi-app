import { describe, expect, it } from "vitest";
import { STORE_STANDARD_BLIND_LEVELS } from "../../../config/tournamentBlindSheets.js";
import {
  buildTournamentConfigFromStage,
  getStaticTournamentRepository,
} from "../../../config/tournamentStages.js";
import { normalizeTournamentDefinition } from "../../../tournament/domain/normalizeTournamentDefinition.js";

describe("DB-ready tournament repository", () => {
  it("returns the Store Tournament definition from the static repository", () => {
    const repository = getStaticTournamentRepository();
    const definition = repository.getTournamentDefinition("store", "badugi");

    expect(definition).toMatchObject({
      schemaVersion: 1,
      id: "store-mtt",
      stageId: "store",
      variantId: "badugi",
      stage: {
        id: "store",
        name: "Store Tournament",
        seatsPerTable: 6,
        totalPlayers: 18,
        startingStack: 500,
      },
      blindStructure: {
        id: "store-standard",
      },
      payoutStructure: {
        payouts: [
          { place: 1, percent: 50 },
          { place: 2, percent: 30 },
          { place: 3, percent: 20 },
        ],
      },
    });
  });

  it("returns the 15-level Store blind structure", () => {
    const repository = getStaticTournamentRepository();
    const blindStructure = repository.getBlindStructure("store-standard");

    expect(blindStructure.levels).toHaveLength(15);
    expect(blindStructure.levels[2]).toMatchObject({
      levelIndex: 3,
      smallBlind: 20,
      bigBlind: 40,
      ante: 2,
      handsThisLevel: 5,
    });
  });

  it("keeps normalized Store config equivalent to the current MTT config", () => {
    const repository = getStaticTournamentRepository();
    const definition = repository.getTournamentDefinition("store", "badugi");
    const normalized = normalizeTournamentDefinition(definition);
    const config = buildTournamentConfigFromStage("store");

    expect(normalized.config).toMatchObject({
      id: config.id,
      name: config.name,
      stageId: config.stageId,
      blindSheetId: config.blindSheetId,
      tables: config.tables,
      seatsPerTable: config.seatsPerTable,
      totalPlayers: config.totalPlayers,
      startingStack: config.startingStack,
      gameId: config.gameId,
      gameVariant: config.gameVariant,
      gameRotation: config.gameRotation,
      rotationPolicy: config.rotationPolicy,
      payouts: config.payouts,
    });
    expect(config.levels).toBe(STORE_STANDARD_BLIND_LEVELS);
  });

  it("routes buildTournamentConfigFromStage through the repository without changing Store output", () => {
    const repository = getStaticTournamentRepository();
    const repositoryConfig = repository.buildTournamentConfig("store");
    const builderConfig = buildTournamentConfigFromStage("store");

    expect(builderConfig).toEqual(repositoryConfig);
    expect(builderConfig.levels).toBe(STORE_STANDARD_BLIND_LEVELS);
  });

  it("returns null for an unknown stage id", () => {
    const repository = getStaticTournamentRepository();

    expect(repository.getTournamentDefinition("missing-stage")).toBeNull();
    expect(repository.buildTournamentConfig("missing-stage")).toBeNull();
    expect(buildTournamentConfigFromStage("missing-stage")).toBeNull();
  });
});
