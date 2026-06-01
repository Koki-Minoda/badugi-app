import { safeGetItem, safeSetItem } from "../../storage/core.js";
import { STORAGE_KEYS } from "../../storage/keys.js";
import { validateTournamentV2 } from "../../storage/schemas.js";

export const CONSOLIDATED_TOURNAMENT_PROGRESS_KEY = STORAGE_KEYS.TOURNAMENT_V2;

const LEGACY_TOURNAMENT_PROGRESS_KEY = "progress.tournament";
const LEGACY_TOURNAMENT_HISTORY_KEY = "history.tournaments";
const LEGACY_PLAYER_PROGRESS_KEY = "playerProgress";
const LEGACY_CAREER_PROFILE_KEY = "mgx.career.profile";
const LEGACY_RIVAL_HISTORY_KEY = "mgx.career.rivals";

const STAGE_IDS = ["store", "local", "national", "world"];
const BASE_VARIANT_ID = "badugi";

const DEFAULT_STAGE_WINS = {
  store: 0,
  local: 0,
  national: 0,
  world: 0,
};

const DEFAULT_STATISTICS = {
  tournamentsPlayed: 0,
  tournamentsWon: 0,
  finalTables: 0,
  headsUps: 0,
  totalPrize: 0,
};

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeParseStorage(key) {
  return safeGetItem(key, null, { silent: true });
}

function normalizeCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0;
}

function normalizePrize(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function normalizeTimestamp(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeStageId(value) {
  const stageId = String(value ?? "").trim().toLowerCase();
  return STAGE_IDS.includes(stageId) ? stageId : stageId || null;
}

function normalizeVariantId(value) {
  const variant = String(value ?? BASE_VARIANT_ID).trim().toLowerCase();
  if (["27td", "2-7-triple-draw", "d01"].includes(variant)) return "2-7td";
  if (["a5td", "a-5-triple-draw", "d02"].includes(variant)) return "a5td";
  return variant || BASE_VARIANT_ID;
}

function normalizeStageWins(...sources) {
  return sources.reduce(
    (acc, source = {}) => {
      STAGE_IDS.forEach((stageId) => {
        acc[stageId] = Math.max(acc[stageId] ?? 0, normalizeCount(source?.[stageId]));
      });
      return acc;
    },
    { ...DEFAULT_STAGE_WINS },
  );
}

function normalizeTournamentEntry(entry = {}) {
  const stage = normalizeStageId(entry.stage ?? entry.stageId);
  const finishPlace = Number(entry.finishPlace ?? entry.placement);
  const completedAt = normalizeTimestamp(
    entry.completedAt ?? entry.finishedAt ?? entry.timestamp,
  );
  return {
    variant: normalizeVariantId(entry.variant ?? entry.gameVariant),
    stage,
    stageId: stage,
    finishPlace: Number.isFinite(finishPlace) ? Math.trunc(finishPlace) : null,
    prize: normalizePrize(entry.prize),
    tournamentId: entry.tournamentId ?? entry.id ?? null,
    completedAt,
  };
}

function completedTournamentKey(entry) {
  return [
    entry.variant ?? BASE_VARIANT_ID,
    entry.stage ?? entry.stageId ?? "",
    entry.finishPlace ?? "",
    entry.tournamentId ?? entry.completedAt ?? "",
  ].join("|");
}

function mergeCompletedTournaments(...sources) {
  const byKey = new Map();
  sources.flat().forEach((raw) => {
    const entry = normalizeTournamentEntry(raw);
    if (!entry.stage || !Number.isFinite(entry.finishPlace)) return;
    const key = completedTournamentKey(entry);
    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
  });
  return [...byKey.values()].sort(
    (a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0),
  );
}

function normalizeHistoryEntry(entry = {}) {
  const stageId = normalizeStageId(entry.stageId ?? entry.stage);
  const placement = Number(entry.placement ?? entry.finishPlace);
  return {
    id: entry.id ?? entry.tournamentId ?? null,
    timestamp: normalizeTimestamp(entry.timestamp ?? entry.completedAt ?? entry.finishedAt),
    variant: normalizeVariantId(entry.variant ?? entry.gameVariant),
    stageId,
    placement: Number.isFinite(placement) ? Math.trunc(placement) : null,
    prize: normalizePrize(entry.prize),
    bankrollAfter: normalizePrize(entry.bankrollAfter),
    feedback: entry.feedback ?? null,
    reason: entry.reason ?? null,
    unlockedAdvancedModes: Boolean(entry.unlockedAdvancedModes),
  };
}

function historyKey(entry) {
  return [
    entry.id ?? "",
    entry.variant ?? BASE_VARIANT_ID,
    entry.stageId ?? "",
    entry.placement ?? "",
    entry.timestamp ?? "",
  ].join("|");
}

function mergeTournamentHistory(...sources) {
  const byKey = new Map();
  sources.flat().forEach((raw) => {
    const entry = normalizeHistoryEntry(raw);
    if (!entry.stageId && !Number.isFinite(entry.placement)) return;
    const key = historyKey(entry);
    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
  });
  return [...byKey.values()].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
}

function normalizeStatistics(statistics = {}) {
  return {
    tournamentsPlayed: normalizeCount(statistics.tournamentsPlayed),
    tournamentsWon: normalizeCount(statistics.tournamentsWon),
    finalTables: normalizeCount(statistics.finalTables),
    headsUps: normalizeCount(statistics.headsUps),
    totalPrize: normalizePrize(statistics.totalPrize),
  };
}

function maxStatistics(...sources) {
  return sources.reduce(
    (acc, source = {}) => {
      const normalized = normalizeStatistics(source);
      Object.keys(DEFAULT_STATISTICS).forEach((key) => {
        acc[key] = Math.max(acc[key] ?? 0, normalized[key] ?? 0);
      });
      return acc;
    },
    { ...DEFAULT_STATISTICS },
  );
}

function normalizeAchievement(entry = {}) {
  return {
    id:
      entry.id ??
      `${entry.type ?? "achievement"}-${entry.variant ?? BASE_VARIANT_ID}-${
        entry.stage ?? entry.stageId ?? "stage"
      }`,
    type: entry.type ?? "achievement",
    variant: normalizeVariantId(entry.variant),
    stage: normalizeStageId(entry.stage ?? entry.stageId),
    label: entry.label ?? "",
    achievedAt: normalizeTimestamp(entry.achievedAt) ?? Date.now(),
  };
}

function mergeAchievements(...sources) {
  const byId = new Map();
  sources.flat().forEach((raw) => {
    const entry = normalizeAchievement(raw);
    const existing = byId.get(entry.id);
    if (!existing || entry.achievedAt < existing.achievedAt) {
      byId.set(entry.id, entry);
    }
  });
  return [...byId.values()].sort((a, b) => a.achievedAt - b.achievedAt);
}

function normalizeWorldChampionship(source = {}) {
  return {
    cleared: Boolean(source.cleared ?? source.worldChampCleared),
    firstClearTimestamp:
      normalizeTimestamp(source.firstClearTimestamp) ??
      normalizeTimestamp(source.firstClearAt) ??
      null,
    clearCount: normalizeCount(source.clearCount),
    lastUnlockPopupAt: normalizeTimestamp(source.lastUnlockPopupAt),
  };
}

function mergeWorldChampionship(...sources) {
  const normalized = sources.map(normalizeWorldChampionship);
  return {
    cleared: normalized.some((source) => source.cleared),
    firstClearTimestamp:
      normalized
        .map((source) => source.firstClearTimestamp)
        .filter(Boolean)
        .sort((a, b) => a - b)[0] ?? null,
    clearCount: Math.max(0, ...normalized.map((source) => source.clearCount)),
    lastUnlockPopupAt:
      normalized
        .map((source) => source.lastUnlockPopupAt)
        .filter(Boolean)
        .sort((a, b) => b - a)[0] ?? null,
  };
}

function normalizeRivalEntry(entry = {}, opponentId = null) {
  return {
    opponentId: entry.opponentId ?? opponentId,
    handsPlayed: normalizeCount(entry.handsPlayed),
    tournamentsMet: normalizeCount(entry.tournamentsMet),
    heroWins: normalizeCount(entry.heroWins),
    opponentWins: normalizeCount(entry.opponentWins),
    lastMetAt: normalizeTimestamp(entry.lastMetAt),
  };
}

function normalizeRivals(rivals = {}) {
  return Object.fromEntries(
    Object.entries(rivals ?? {}).map(([opponentId, entry]) => [
      opponentId,
      normalizeRivalEntry(entry, opponentId),
    ]),
  );
}

function mergeRivals(...sources) {
  const result = {};
  sources.forEach((source = {}) => {
    Object.entries(normalizeRivals(source)).forEach(([opponentId, entry]) => {
      const current = result[opponentId] ?? normalizeRivalEntry({}, opponentId);
      result[opponentId] = {
        opponentId,
        handsPlayed: Math.max(current.handsPlayed, entry.handsPlayed),
        tournamentsMet: Math.max(current.tournamentsMet, entry.tournamentsMet),
        heroWins: Math.max(current.heroWins, entry.heroWins),
        opponentWins: Math.max(current.opponentWins, entry.opponentWins),
        lastMetAt: Math.max(current.lastMetAt ?? 0, entry.lastMetAt ?? 0) || null,
      };
    });
  });
  return result;
}

function normalizeConsolidatedProgress(progress = {}) {
  const defaults = createDefaultConsolidatedProgress();
  return {
    version: 2,
    tournament: {
      bankroll: normalizePrize(progress?.tournament?.bankroll),
      stageWins: normalizeStageWins(progress?.tournament?.stageWins),
      completedTournaments: mergeCompletedTournaments(
        progress?.tournament?.completedTournaments ?? [],
      ),
      lastResult: progress?.tournament?.lastResult ?? null,
      history: mergeTournamentHistory(progress?.tournament?.history ?? []),
    },
    career: {
      unlockedVariants: Array.from(
        new Set([
          BASE_VARIANT_ID,
          ...(Array.isArray(progress?.career?.unlockedVariants)
            ? progress.career.unlockedVariants.map(normalizeVariantId)
            : []),
        ]),
      ),
      achievements: mergeAchievements(progress?.career?.achievements ?? []),
      statistics: normalizeStatistics(progress?.career?.statistics),
      worldChampionship: mergeWorldChampionship(
        progress?.career?.worldChampionship,
      ),
    },
    rivals: normalizeRivals(progress?.rivals),
    _meta: {
      ...defaults._meta,
      ...(progress?._meta ?? {}),
      migratedFrom: Array.isArray(progress?._meta?.migratedFrom)
        ? [...new Set(progress._meta.migratedFrom)]
        : [],
      legacyKeysRetained: true,
    },
  };
}

export function createDefaultConsolidatedProgress() {
  return {
    version: 2,
    tournament: {
      bankroll: 0,
      stageWins: { ...DEFAULT_STAGE_WINS },
      completedTournaments: [],
      lastResult: null,
      history: [],
    },
    career: {
      unlockedVariants: [BASE_VARIANT_ID],
      achievements: [],
      statistics: { ...DEFAULT_STATISTICS },
      worldChampionship: {
        cleared: false,
        firstClearTimestamp: null,
        clearCount: 0,
        lastUnlockPopupAt: null,
      },
    },
    rivals: {},
    _meta: {
      migratedFrom: [],
      migratedAt: null,
      legacyKeysRetained: true,
    },
  };
}

export function loadConsolidatedProgress() {
  const stored = safeGetItem(STORAGE_KEYS.TOURNAMENT_V2, null, { silent: true });
  if (!validateTournamentV2(stored)) return createDefaultConsolidatedProgress();
  return normalizeConsolidatedProgress(stored);
}

export function getPlayerProgressFromConsolidated(
  v2 = loadConsolidatedProgress(),
) {
  const tournament = v2?.tournament ?? {};
  const career = v2?.career ?? {};
  const worldChampionship = career?.worldChampionship ?? {};

  return {
    stageWins: {
      store: tournament?.stageWins?.store ?? 0,
      local: tournament?.stageWins?.local ?? 0,
      national: tournament?.stageWins?.national ?? 0,
      world: tournament?.stageWins?.world ?? 0,
    },
    worldChampCleared: Boolean(worldChampionship?.cleared),
    firstClearTimestamp: worldChampionship?.firstClearTimestamp ?? null,
    clearCount: worldChampionship?.clearCount ?? 0,
    lastUnlockPopupAt: worldChampionship?.lastUnlockPopupAt ?? null,
  };
}

export function saveConsolidatedProgress(progress) {
  const normalized = normalizeConsolidatedProgress(progress);
  const saved = safeSetItem(STORAGE_KEYS.TOURNAMENT_V2, normalized, {
    silent: true,
  });
  if (!saved) {
    console.warn("[TD2][SAVE_FAILED]");
  }
  return normalized;
}

function readLegacySources() {
  return {
    tournamentProgress: safeParseStorage(LEGACY_TOURNAMENT_PROGRESS_KEY),
    tournamentHistory: safeParseStorage(LEGACY_TOURNAMENT_HISTORY_KEY),
    playerProgress: safeParseStorage(LEGACY_PLAYER_PROGRESS_KEY),
    careerProfile: safeParseStorage(LEGACY_CAREER_PROFILE_KEY),
    rivalHistory: safeParseStorage(LEGACY_RIVAL_HISTORY_KEY),
  };
}

function legacySourceKeys(sources) {
  const keyMap = {
    tournamentProgress: LEGACY_TOURNAMENT_PROGRESS_KEY,
    tournamentHistory: LEGACY_TOURNAMENT_HISTORY_KEY,
    playerProgress: LEGACY_PLAYER_PROGRESS_KEY,
    careerProfile: LEGACY_CAREER_PROFILE_KEY,
    rivalHistory: LEGACY_RIVAL_HISTORY_KEY,
  };
  return Object.entries(sources)
    .filter(([, value]) => value != null)
    .map(([key]) => keyMap[key]);
}

function buildLegacyAggregate(sources = readLegacySources()) {
  const career = sources.careerProfile ?? {};
  const playerProgress = sources.playerProgress ?? {};
  const tournamentProgress = sources.tournamentProgress ?? {};
  const tournamentHistory = Array.isArray(sources.tournamentHistory)
    ? sources.tournamentHistory
    : [];
  const rivalHistory = sources.rivalHistory ?? {};

  return {
    tournament: {
      bankroll: normalizePrize(tournamentProgress.bankroll),
      stageWins: normalizeStageWins(
        tournamentProgress.wins,
        tournamentProgress.stageWins,
        playerProgress.stageWins,
      ),
      completedTournaments: mergeCompletedTournaments(
        tournamentProgress.completedTournaments ?? [],
        career.completedTournaments ?? [],
      ),
      lastResult: tournamentProgress.lastResult ?? null,
      history: mergeTournamentHistory(tournamentHistory),
    },
    career: {
      unlockedVariants: Array.from(
        new Set([
          BASE_VARIANT_ID,
          ...(Array.isArray(career.unlockedVariants)
            ? career.unlockedVariants.map(normalizeVariantId)
            : []),
        ]),
      ),
      achievements: mergeAchievements(career.achievements ?? []),
      statistics: normalizeStatistics(career.statistics),
      worldChampionship: mergeWorldChampionship({
        cleared: playerProgress.worldChampCleared,
        firstClearTimestamp: playerProgress.firstClearTimestamp,
        clearCount: playerProgress.clearCount,
        lastUnlockPopupAt: playerProgress.lastUnlockPopupAt,
      }),
    },
    rivals: normalizeRivals(rivalHistory.rivals ?? {}),
  };
}

export function migrateLegacyProgressToV2() {
  const existing = loadConsolidatedProgress();
  const sources = readLegacySources();
  const legacy = buildLegacyAggregate(sources);
  const migratedFrom = [
    ...new Set([...(existing._meta.migratedFrom ?? []), ...legacySourceKeys(sources)]),
  ];
  const migratedAt =
    migratedFrom.length > 0
      ? (existing._meta.migratedAt ?? Date.now())
      : existing._meta.migratedAt;

  return saveConsolidatedProgress({
    version: 2,
    tournament: {
      bankroll: Math.max(existing.tournament.bankroll, legacy.tournament.bankroll),
      stageWins: normalizeStageWins(
        existing.tournament.stageWins,
        legacy.tournament.stageWins,
      ),
      completedTournaments: mergeCompletedTournaments(
        existing.tournament.completedTournaments,
        legacy.tournament.completedTournaments,
      ),
      lastResult: existing.tournament.lastResult ?? legacy.tournament.lastResult,
      history: mergeTournamentHistory(
        existing.tournament.history,
        legacy.tournament.history,
      ),
    },
    career: {
      unlockedVariants: Array.from(
        new Set([
          ...existing.career.unlockedVariants,
          ...legacy.career.unlockedVariants,
        ]),
      ),
      achievements: mergeAchievements(
        existing.career.achievements,
        legacy.career.achievements,
      ),
      statistics: maxStatistics(
        existing.career.statistics,
        legacy.career.statistics,
      ),
      worldChampionship: mergeWorldChampionship(
        existing.career.worldChampionship,
        legacy.career.worldChampionship,
      ),
    },
    rivals: mergeRivals(existing.rivals, legacy.rivals),
    _meta: {
      migratedFrom,
      migratedAt,
      legacyKeysRetained: true,
    },
  });
}

export function recordConsolidatedTournamentResult(result = {}) {
  const current = loadConsolidatedProgress();
  const completedAt = normalizeTimestamp(result.completedAt) ?? Date.now();
  const entry = normalizeTournamentEntry({
    ...result,
    completedAt,
    stage: result.stage ?? result.stageId,
    finishPlace: result.finishPlace ?? result.placement,
  });
  if (!entry.stage || !Number.isFinite(entry.finishPlace)) {
    return current;
  }

  const stageWins = { ...current.tournament.stageWins };
  if (entry.finishPlace === 1 && STAGE_IDS.includes(entry.stage)) {
    stageWins[entry.stage] = (stageWins[entry.stage] ?? 0) + 1;
  }

  const historyEntry = normalizeHistoryEntry({
    ...result,
    stageId: entry.stage,
    placement: entry.finishPlace,
    completedAt,
    timestamp: completedAt,
  });
  const statistics = {
    tournamentsPlayed: current.career.statistics.tournamentsPlayed + 1,
    tournamentsWon:
      current.career.statistics.tournamentsWon + (entry.finishPlace === 1 ? 1 : 0),
    finalTables:
      current.career.statistics.finalTables + normalizeCount(result.finalTables),
    headsUps: current.career.statistics.headsUps + normalizeCount(result.headsUps),
    totalPrize: current.career.statistics.totalPrize + entry.prize,
  };
  const worldChampionship = {
    ...current.career.worldChampionship,
  };
  if (entry.stage === "world" && entry.finishPlace === 1) {
    worldChampionship.cleared = true;
    worldChampionship.firstClearTimestamp =
      worldChampionship.firstClearTimestamp ?? completedAt;
    worldChampionship.clearCount = (worldChampionship.clearCount ?? 0) + 1;
  }

  const lastResult = {
    variant: entry.variant,
    stageId: entry.stage,
    placement: entry.finishPlace,
    finishPlace: entry.finishPlace,
    prize: entry.prize,
    tournamentId: entry.tournamentId,
    completedAt,
  };

  return saveConsolidatedProgress({
    ...current,
    tournament: {
      ...current.tournament,
      bankroll: Math.max(0, current.tournament.bankroll + entry.prize),
      stageWins,
      completedTournaments: [...current.tournament.completedTournaments, entry],
      lastResult,
      history: [historyEntry, ...current.tournament.history].slice(0, 200),
    },
    career: {
      ...current.career,
      statistics,
      worldChampionship,
    },
  });
}

function collectDriftDetails(legacy, v2) {
  const drift = {};
  STAGE_IDS.forEach((stageId) => {
    if (
      normalizeCount(legacy.tournament.stageWins?.[stageId]) !==
      normalizeCount(v2.tournament.stageWins?.[stageId])
    ) {
      drift.stageWins = {
        ...(drift.stageWins ?? {}),
        [stageId]: {
          legacy: normalizeCount(legacy.tournament.stageWins?.[stageId]),
          v2: normalizeCount(v2.tournament.stageWins?.[stageId]),
        },
      };
    }
  });
  if (
    legacy.tournament.completedTournaments.length !==
    v2.tournament.completedTournaments.length
  ) {
    drift.completedTournamentsLength = {
      legacy: legacy.tournament.completedTournaments.length,
      v2: v2.tournament.completedTournaments.length,
    };
  }
  if (
    Boolean(legacy.career.worldChampionship.cleared) !==
    Boolean(v2.career.worldChampionship.cleared)
  ) {
    drift.worldChampCleared = {
      legacy: Boolean(legacy.career.worldChampionship.cleared),
      v2: Boolean(v2.career.worldChampionship.cleared),
    };
  }
  if (
    normalizeCount(legacy.career.statistics.tournamentsPlayed) !==
    normalizeCount(v2.career.statistics.tournamentsPlayed)
  ) {
    drift.statistics = {
      tournamentsPlayed: {
        legacy: normalizeCount(legacy.career.statistics.tournamentsPlayed),
        v2: normalizeCount(v2.career.statistics.tournamentsPlayed),
      },
    };
  }
  return drift;
}

export function detectLegacyProgressDrift() {
  const legacy = buildLegacyAggregate();
  const v2 = loadConsolidatedProgress();
  const drift = collectDriftDetails(legacy, v2);
  if (Object.keys(drift).length > 0) {
    console.warn("[TD1][PROGRESS-DRIFT]", drift);
  }
  return drift;
}

export const __testing = {
  buildLegacyAggregate,
  mergeCompletedTournaments,
  normalizeConsolidatedProgress,
};
