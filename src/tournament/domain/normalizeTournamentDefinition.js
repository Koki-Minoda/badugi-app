import { TOURNAMENT_DEFINITION_SCHEMA_VERSION } from "./tournamentDefinitions.js";

const DEFAULT_TABLE_SIZE = 6;

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toPositiveInteger(value, fallback = 0) {
  const number = Math.trunc(toFiniteNumber(value, fallback));
  return number > 0 ? number : fallback;
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

export function resolveTournamentEntrants(stage = {}) {
  const explicitTotal = toFiniteNumber(stage.totalPlayers ?? stage.defaultEntrants, NaN);
  if (Number.isFinite(explicitTotal) && explicitTotal > 0) {
    return Math.trunc(explicitTotal);
  }
  const [minEntrants, maxEntrants] = Array.isArray(stage.participantsRange)
    ? stage.participantsRange
    : [];
  const min = toFiniteNumber(minEntrants, NaN);
  const max = toFiniteNumber(maxEntrants, NaN);
  if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
    return Math.round((min + max) / 2);
  }
  return DEFAULT_TABLE_SIZE;
}

export function normalizeBlindLevel(raw = {}, index = 0) {
  const levelIndex = toPositiveInteger(
    raw.levelIndex ?? raw.level ?? raw.levelNumber,
    index + 1,
  );
  return {
    levelIndex,
    levelNumber: levelIndex,
    smallBlind: toFiniteNumber(raw.smallBlind ?? raw.sb, 0),
    bigBlind: toFiniteNumber(raw.bigBlind ?? raw.bb, 0),
    ante: toFiniteNumber(raw.ante, 0),
    handsThisLevel: toPositiveInteger(raw.handsThisLevel ?? raw.hands, 0),
  };
}

export function normalizeBlindStructure(raw = null) {
  if (!raw) return null;
  return {
    id: raw.id ?? null,
    label: raw.label ?? raw.name ?? raw.id ?? "",
    stageIds: Array.isArray(raw.stageIds) ? [...raw.stageIds] : [],
    levelDurationMinutes: toFiniteNumber(raw.levelDurationMinutes, 0),
    breakEveryLevels: raw.breakEveryLevels ?? null,
    breakDurationMinutes: raw.breakDurationMinutes ?? null,
    levels: Array.isArray(raw.levels)
      ? raw.levels.map((level, index) => normalizeBlindLevel(level, index))
      : [],
  };
}

export function normalizePayoutStructure(raw = []) {
  const rows = Array.isArray(raw) ? raw : raw?.payouts ?? raw?.prizeTable ?? [];
  const amountRows = rows
    .filter((row) => Array.isArray(row?.places) && row.places[0] === row.places[1])
    .map((row) => ({
      place: toPositiveInteger(row.places[0], 0),
      amount: toFiniteNumber(row.payout ?? row.amount, 0),
    }))
    .filter((row) => row.place > 0 && row.amount > 0);
  const amountTotal = amountRows.reduce((sum, row) => sum + row.amount, 0);
  if (amountTotal > 0) {
    return {
      payouts: amountRows.map((row) => ({
        place: row.place,
        percent: Number(((row.amount / amountTotal) * 100).toFixed(4)),
      })),
      rewards: amountRows.map((row) => ({
        place: row.place,
        amount: row.amount,
        percent: Number(((row.amount / amountTotal) * 100).toFixed(4)),
      })),
    };
  }
  const payoutRows = rows
    .map((row) => ({
      place: toPositiveInteger(row?.place, 0),
      percent: toFiniteNumber(row?.percent, 0),
    }))
    .filter((row) => row.place > 0 && row.percent > 0);
  return {
    payouts: payoutRows,
    rewards: payoutRows.map((row) => ({ ...row, amount: 0 })),
  };
}

export function normalizeTournamentStage(raw = {}) {
  const seatsPerTable = toPositiveInteger(raw.tableSize ?? raw.seatsPerTable, DEFAULT_TABLE_SIZE);
  return {
    id: raw.id ?? null,
    name: raw.tournamentName ?? raw.name ?? raw.label ?? raw.id ?? "",
    label: raw.label ?? raw.id ?? "",
    seriesLabel: raw.seriesLabel ?? raw.description ?? "",
    description: raw.description ?? "",
    stageOrder: toFiniteNumber(raw.difficulty, 0),
    blindSheetId: raw.blindSheetId ?? null,
    proBlindSheetId: raw.proBlindSheetId ?? null,
    gameId: raw.gameId ?? raw.eligibility?.gameId ?? "D03",
    gameVariant: raw.gameVariant ?? raw.eligibility?.gameVariant ?? "badugi",
    gameRotation: raw.gameRotation ?? raw.eligibility?.gameRotation ?? ["badugi"],
    rotationPolicy: raw.rotationPolicy ?? raw.eligibility?.rotationPolicy ?? "fixed",
    startingStack: toFiniteNumber(raw.startingStack, 0),
    seatsPerTable,
    totalPlayers: resolveTournamentEntrants(raw),
    entryFee: toFiniteNumber(raw.entryFee, 0),
    eligibility: cloneJson(raw.eligibility ?? null),
  };
}

export function normalizeTournamentDefinition(raw = {}) {
  const stage = normalizeTournamentStage(raw.stage ?? raw);
  const blindStructure = normalizeBlindStructure(raw.blindStructure ?? null);
  const payoutStructure = normalizePayoutStructure(
    raw.payoutStructure ?? raw.stage?.prizeTable ?? raw.prizeTable ?? [],
  );
  return {
    schemaVersion: TOURNAMENT_DEFINITION_SCHEMA_VERSION,
    id: raw.id ?? raw.config?.id ?? `${stage.id}-mtt`,
    stageId: stage.id,
    variantId: raw.variantId ?? stage.gameVariant,
    stage,
    blindStructure,
    payoutStructure,
    unlockConditions: Array.isArray(raw.unlockConditions)
      ? cloneJson(raw.unlockConditions)
      : [],
    config: raw.config ? cloneJson(raw.config) : null,
  };
}
