import {
  normalizeBlindStructure,
  normalizePayoutStructure,
  normalizeTournamentDefinition,
  normalizeTournamentStage,
  resolveTournamentEntrants,
} from "./normalizeTournamentDefinition.js";

const DEFAULT_TABLE_SIZE = 6;

function formatStageTournamentName(stage) {
  if (stage?.tournamentName) return stage.tournamentName;
  const id = String(stage?.id ?? "tournament");
  return `${id.charAt(0).toUpperCase()}${id.slice(1)} Tournament`;
}

function buildConfigFromStage(stage, blindSheet) {
  if (!stage) return null;
  const seatsPerTable = Number(stage.tableSize) || DEFAULT_TABLE_SIZE;
  const totalPlayers = resolveTournamentEntrants(stage);
  const payoutStructure = normalizePayoutStructure(stage.prizeTable);
  const gameSettings = {
    gameId: stage.gameId ?? stage.eligibility?.gameId ?? "D03",
    gameVariant: stage.gameVariant ?? stage.eligibility?.gameVariant ?? "badugi",
    gameRotation:
      stage.gameRotation ?? stage.eligibility?.gameRotation ?? ["badugi"],
    rotationPolicy:
      stage.rotationPolicy ?? stage.eligibility?.rotationPolicy ?? "fixed",
  };

  return {
    id: stage.tournamentConfigId ?? `${stage.id}-mtt`,
    name: formatStageTournamentName(stage),
    stageId: stage.id,
    blindSheetId: stage.blindSheetId,
    tables: Math.max(1, Math.ceil(totalPlayers / seatsPerTable)),
    seatsPerTable,
    totalPlayers,
    startingStack: stage.startingStack,
    ...gameSettings,
    levels: blindSheet?.levels ?? [],
    payouts: payoutStructure.payouts,
  };
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

export function createTournamentRepository({
  stages = [],
  blindSheets = {},
  unlockConditions = [],
  series = null,
} = {}) {
  const stageList = Array.isArray(stages) ? stages : [];
  const blindSheetMap = blindSheets ?? {};

  function getStageRaw(stageId) {
    return stageList.find((stage) => stage.id === stageId) ?? null;
  }

  function getBlindSheetRaw(blindSheetId) {
    if (!blindSheetId) return null;
    return blindSheetMap[blindSheetId] ?? null;
  }

  function getBlindSheetForStage(stageId) {
    const stage = getStageRaw(stageId);
    if (stage?.blindSheetId) return getBlindSheetRaw(stage.blindSheetId);
    return (
      Object.values(blindSheetMap).find(
        (sheet) =>
          Array.isArray(sheet?.stageIds) && sheet.stageIds.includes(stageId),
      ) ?? null
    );
  }

  return {
    getTournamentSeries() {
      if (Array.isArray(series) && series.length) return cloneJson(series);
      return [
        {
          id: "badugi-series",
          name: "Badugi Series",
          variantId: "badugi",
          stageIds: stageList.map((stage) => stage.id),
        },
      ];
    },

    getTournamentStages() {
      return stageList.map((stage) => normalizeTournamentStage(stage));
    },

    getTournamentStage(stageId) {
      const stage = getStageRaw(stageId);
      return stage ? normalizeTournamentStage(stage) : null;
    },

    getBlindStructure(blindSheetId) {
      return normalizeBlindStructure(getBlindSheetRaw(blindSheetId));
    },

    getBlindStructureForStage(stageId) {
      return normalizeBlindStructure(getBlindSheetForStage(stageId));
    },

    getUnlockConditions() {
      return cloneJson(unlockConditions);
    },

    getTournamentDefinition(stageId, variantId = "badugi") {
      const stage = getStageRaw(stageId);
      if (!stage) return null;
      const blindSheet = getBlindSheetForStage(stage.id);
      const config = buildConfigFromStage(stage, blindSheet);
      return normalizeTournamentDefinition({
        id: config?.id,
        stage,
        blindStructure: blindSheet,
        payoutStructure: stage.prizeTable,
        unlockConditions,
        variantId: variantId ?? config?.gameVariant,
        config,
      });
    },

    buildTournamentConfig(stageId, variantId = "badugi") {
      const stage = getStageRaw(stageId);
      if (!stage) return null;
      const blindSheet = getBlindSheetForStage(stage.id);
      return buildConfigFromStage(stage, blindSheet, variantId);
    },
  };
}

export { buildConfigFromStage as buildTournamentConfigFromDefinition };
