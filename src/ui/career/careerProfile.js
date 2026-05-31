import {
  TOURNAMENT_VARIANTS,
  evaluateTournamentUnlocks,
  getTournamentVariantById,
} from "../../config/tournamentUnlocks.js";
import { TOURNAMENT_STAGE_IDS, getStageById } from "../../config/tournamentStages.js";

export const CAREER_PROFILE_KEY = "mgx.career.profile";
export const CAREER_PROFILE_VERSION = 1;
export const BASE_CAREER_VARIANT_ID = "badugi";

const DEFAULT_STATISTICS = {
  tournamentsPlayed: 0,
  tournamentsWon: 0,
  finalTables: 0,
  headsUps: 0,
  totalPrize: 0,
};

const DEFAULT_PROFILE = {
  version: CAREER_PROFILE_VERSION,
  unlockedVariants: [BASE_CAREER_VARIANT_ID],
  completedTournaments: [],
  achievements: [],
  statistics: { ...DEFAULT_STATISTICS },
};

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeVariantId(variantId) {
  const value = String(variantId ?? "").trim().toLowerCase();
  if (["d01", "27td", "2-7-triple-draw"].includes(value)) return "2-7td";
  if (["d02", "a5td", "a-5-triple-draw"].includes(value)) return "a5td";
  return getTournamentVariantById(value)?.id ?? value ?? BASE_CAREER_VARIANT_ID;
}

function normalizeCompletedTournament(entry = {}) {
  const stage = String(entry.stage ?? entry.stageId ?? "").trim().toLowerCase();
  const finishPlace = Number(entry.finishPlace ?? entry.placement);
  return {
    variant: normalizeVariantId(entry.variant ?? entry.gameVariant ?? BASE_CAREER_VARIANT_ID),
    stage,
    stageId: stage,
    finishPlace: Number.isFinite(finishPlace) ? finishPlace : null,
    prize: Math.max(0, Number(entry.prize) || 0),
    tournamentId: entry.tournamentId ?? null,
    completedAt: Number(entry.completedAt ?? entry.finishedAt ?? Date.now()),
  };
}

function normalizeAchievement(entry = {}) {
  return {
    id: entry.id ?? `${entry.type ?? "achievement"}-${entry.variant ?? "badugi"}-${entry.stage ?? "stage"}`,
    type: entry.type ?? "achievement",
    variant: normalizeVariantId(entry.variant ?? BASE_CAREER_VARIANT_ID),
    stage: entry.stage ?? entry.stageId ?? null,
    label: entry.label ?? "",
    achievedAt: Number(entry.achievedAt ?? Date.now()),
  };
}

function normalizeStatistics(statistics = {}) {
  return {
    tournamentsPlayed: Math.max(0, Number(statistics.tournamentsPlayed) || 0),
    tournamentsWon: Math.max(0, Number(statistics.tournamentsWon) || 0),
    finalTables: Math.max(0, Number(statistics.finalTables) || 0),
    headsUps: Math.max(0, Number(statistics.headsUps) || 0),
    totalPrize: Math.max(0, Number(statistics.totalPrize) || 0),
  };
}

export function normalizeCareerProfile(profile = {}) {
  const completedTournaments = Array.isArray(profile.completedTournaments)
    ? profile.completedTournaments
        .map(normalizeCompletedTournament)
        .filter((entry) => entry.stage && Number.isFinite(entry.finishPlace))
    : [];
  const unlockState = evaluateTournamentUnlocks({ completedTournaments });
  const unlockedVariants = Array.from(
    new Set([
      BASE_CAREER_VARIANT_ID,
      ...(Array.isArray(profile.unlockedVariants)
        ? profile.unlockedVariants.map(normalizeVariantId)
        : []),
      ...unlockState.unlockedVariants,
    ]),
  );

  return {
    version: CAREER_PROFILE_VERSION,
    unlockedVariants,
    completedTournaments,
    achievements: Array.isArray(profile.achievements)
      ? profile.achievements.map(normalizeAchievement)
      : [],
    statistics: normalizeStatistics(profile.statistics),
  };
}

export function createDefaultCareerProfile() {
  return normalizeCareerProfile(DEFAULT_PROFILE);
}

export function loadCareerProfile() {
  if (!hasStorage()) return createDefaultCareerProfile();
  try {
    const raw = window.localStorage.getItem(CAREER_PROFILE_KEY);
    if (!raw) return createDefaultCareerProfile();
    return normalizeCareerProfile(JSON.parse(raw));
  } catch (err) {
    console.warn("[Career] Failed to load career profile:", err);
    return createDefaultCareerProfile();
  }
}

export function saveCareerProfile(profile) {
  const normalized = normalizeCareerProfile(profile);
  if (hasStorage()) {
    window.localStorage.setItem(CAREER_PROFILE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function resetCareerProfile() {
  const next = createDefaultCareerProfile();
  if (hasStorage()) {
    window.localStorage.setItem(CAREER_PROFILE_KEY, JSON.stringify(next));
  }
  return next;
}

function buildChampionAchievement(entry) {
  const variant = getTournamentVariantById(entry.variant);
  const stage = getStageById(entry.stage);
  return {
    id: `champion-${entry.variant}-${entry.stage}`,
    type: "stageChampion",
    variant: entry.variant,
    stage: entry.stage,
    label: `${variant?.label ?? entry.variant} ${stage?.tournamentName ?? stage?.label ?? entry.stage} Champion`,
    achievedAt: entry.completedAt,
  };
}

export function recordCareerTournamentResult(result = {}) {
  const current = loadCareerProfile();
  const entry = normalizeCompletedTournament(result);
  if (!entry.stage || !Number.isFinite(entry.finishPlace)) return current;

  const completedTournaments = [...current.completedTournaments, entry];
  const achievements = [...current.achievements];
  if (entry.finishPlace === 1) {
    const championAchievement = buildChampionAchievement(entry);
    const existingIndex = achievements.findIndex(
      (achievement) => achievement.id === championAchievement.id,
    );
    if (existingIndex >= 0) {
      achievements[existingIndex] = {
        ...achievements[existingIndex],
        achievedAt: Math.min(
          achievements[existingIndex].achievedAt,
          championAchievement.achievedAt,
        ),
      };
    } else {
      achievements.push(championAchievement);
    }
  }

  const statistics = {
    tournamentsPlayed: current.statistics.tournamentsPlayed + 1,
    tournamentsWon:
      current.statistics.tournamentsWon + (entry.finishPlace === 1 ? 1 : 0),
    finalTables: current.statistics.finalTables + (entry.finishPlace <= 6 ? 1 : 0),
    headsUps: current.statistics.headsUps + (entry.finishPlace <= 2 ? 1 : 0),
    totalPrize: current.statistics.totalPrize + entry.prize,
  };

  return saveCareerProfile({
    ...current,
    completedTournaments,
    achievements,
    statistics,
  });
}

export function getCareerChampionRecords(profile = loadCareerProfile()) {
  const normalized = normalizeCareerProfile(profile);
  return normalized.achievements
    .filter((achievement) => achievement.type === "stageChampion")
    .sort((a, b) => a.achievedAt - b.achievedAt);
}

export function buildCareerProgressMap(profile = loadCareerProfile(), variantId = "badugi") {
  const normalized = normalizeCareerProfile(profile);
  const variant = normalizeVariantId(variantId);
  const variantUnlocked = normalized.unlockedVariants.includes(variant);
  return TOURNAMENT_STAGE_IDS.map((stageId) => {
    const championEntry = normalized.completedTournaments.find(
      (entry) =>
        entry.variant === variant &&
        entry.stage === stageId &&
        entry.finishPlace === 1,
    );
    return {
      stageId,
      label: getStageById(stageId)?.tournamentName ?? stageId,
      champion: Boolean(championEntry),
      completedAt: championEntry?.completedAt ?? null,
      locked: !variantUnlocked,
      status: !variantUnlocked ? "locked" : championEntry ? "champion" : "open",
    };
  });
}

export function buildCareerViewModel(profile = loadCareerProfile()) {
  const normalized = normalizeCareerProfile(profile);
  const badugiMap = buildCareerProgressMap(normalized, BASE_CAREER_VARIANT_ID);
  const championCount = badugiMap.filter((stage) => stage.champion).length;
  const progressPercent = Math.round((championCount / badugiMap.length) * 100);
  return {
    profile: cloneJson(normalized),
    badugiProgress: {
      stages: badugiMap,
      completed: championCount,
      total: badugiMap.length,
      percent: progressPercent,
    },
    variants: TOURNAMENT_VARIANTS.map((variant) => ({
      id: variant.id,
      label: variant.label,
      playable: normalized.unlockedVariants.includes(variant.id),
    })),
    championRecords: getCareerChampionRecords(normalized),
    statistics: { ...normalized.statistics },
  };
}
