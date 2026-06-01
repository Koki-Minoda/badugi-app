import { getStageById, TOURNAMENT_STAGES } from "../../config/tournamentStages";
import { safeGetItem, safeRemoveItem, safeSetItem } from "../../storage/core.js";
import { STORAGE_KEYS } from "../../storage/keys.js";
import { recordCareerTournamentResult } from "../career/careerProfile.js";
import { recordStageWin, updateProgressAfterWorldChampClear } from "./playerProgress";

const PROGRESS_KEY = STORAGE_KEYS.TOURNAMENT_PROGRESS;
const HISTORY_KEY = STORAGE_KEYS.TOURNAMENT_HISTORY;

function randomId(prefix = "tourney") {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  const salt = Math.floor(Math.random() * 10_000);
  return `${prefix}-${Date.now()}-${salt}`;
}

const DEFAULT_PROGRESS = {
  bankroll: 0,
  wins: {
    store: 0,
    local: 0,
    national: 0,
    world: 0,
  },
  completedTournaments: [],
  lastResult: null,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadTournamentProgress() {
  const parsed = safeGetItem(PROGRESS_KEY, null, { silent: true });
  if (!parsed) return clone(DEFAULT_PROGRESS);
  return {
    ...clone(DEFAULT_PROGRESS),
    ...parsed,
    wins: { ...clone(DEFAULT_PROGRESS).wins, ...(parsed?.wins ?? {}) },
    completedTournaments: Array.isArray(parsed?.completedTournaments)
      ? parsed.completedTournaments
      : [],
  };
}

export function saveTournamentProgress(progress) {
  const next = {
    ...clone(DEFAULT_PROGRESS),
    ...progress,
    wins: { ...clone(DEFAULT_PROGRESS).wins, ...(progress?.wins ?? {}) },
    completedTournaments: Array.isArray(progress?.completedTournaments)
      ? progress.completedTournaments
      : [],
  };
  safeSetItem(PROGRESS_KEY, next, { silent: true });
  return next;
}

export function resetTournamentProgress() {
  safeRemoveItem(PROGRESS_KEY, { silent: true });
  return clone(DEFAULT_PROGRESS);
}

export function getTournamentHistory() {
  const history = safeGetItem(HISTORY_KEY, [], { silent: true });
  return Array.isArray(history) ? history : [];
}

export function appendTournamentHistory(entry) {
  const history = getTournamentHistory();
  const next = [
    {
      id: entry?.id ?? randomId("tourney"),
      timestamp: Date.now(),
      ...entry,
    },
    ...history,
  ].slice(0, 200);
  safeSetItem(HISTORY_KEY, next, { silent: true });
  return next;
}

export function getStageEligibility(stageId, progress = loadTournamentProgress()) {
  const stage = getStageById(stageId);
  if (!stage) {
    return { eligible: false, reason: "ステージが見つかりません" };
  }
  const requires = stage.eligibility?.requires;
  if (!requires) {
    return { eligible: true, reason: stage.eligibility?.text ?? "" };
  }
  const wins = progress?.wins ?? {};
  if (requires.storeWins && (wins.store ?? 0) < requires.storeWins) {
    return { eligible: false, reason: `店舗優勝が${requires.storeWins}回必要` };
  }
  if (requires.localWins && (wins.local ?? 0) < requires.localWins) {
    return { eligible: false, reason: `地方優勝が${requires.localWins}回必要` };
  }
  if (requires.nationalWins && (wins.national ?? 0) < requires.nationalWins) {
    return { eligible: false, reason: `全国優勝が${requires.nationalWins}回必要` };
  }
  return { eligible: true, reason: stage.eligibility?.text ?? "" };
}

export function canAffordEntry(stageId, progress = loadTournamentProgress()) {
  const stage = getStageById(stageId);
  if (!stage) return { ok: false, reason: "ステージが見つかりません" };
  const bankroll = progress?.bankroll ?? 0;
  if (bankroll >= stage.entryFee) {
    return { ok: true, remaining: bankroll - stage.entryFee };
  }
  return { ok: false, reason: `必要スタック ${stage.entryFee} に不足 (${bankroll})` };
}

export function deductEntryFee(stageId) {
  const stage = getStageById(stageId);
  if (!stage) {
    return { ok: false, progress: loadTournamentProgress(), reason: "ステージが見つかりません" };
  }
  const progress = loadTournamentProgress();
  if (stage.entryFee === 0) {
    return { ok: true, progress };
  }
  const bankroll = progress.bankroll ?? 0;
  if (bankroll < stage.entryFee) {
    return { ok: false, progress, reason: "バンクロール不足" };
  }
  const next = saveTournamentProgress({
    ...progress,
    bankroll: bankroll - stage.entryFee,
  });
  return { ok: true, progress: next };
}

function normalizeCompletedTournamentEntry({
  variant = "badugi",
  stage,
  stageId,
  finishPlace,
  placement,
  tournamentId,
  completedAt = Date.now(),
} = {}) {
  return {
    variant,
    stage: stage ?? stageId,
    finishPlace: Number(finishPlace ?? placement),
    tournamentId: tournamentId ?? null,
    completedAt,
  };
}

export function recordCompletedTournament(result = {}) {
  const progress = loadTournamentProgress();
  const entry = normalizeCompletedTournamentEntry(result);
  if (!entry.stage || !Number.isFinite(entry.finishPlace)) {
    return progress;
  }
  return saveTournamentProgress({
    ...progress,
    completedTournaments: [
      ...(Array.isArray(progress.completedTournaments)
        ? progress.completedTournaments
        : []),
      entry,
    ],
  });
}

export function applyTournamentResult({
  stageId,
  variant = "badugi",
  placement,
  prize = 0,
  feedback,
  reason,
  tournamentId = null,
}) {
  recordCareerTournamentResult({
    variant,
    stageId,
    finishPlace: placement,
    prize,
    tournamentId,
  });
  const progress = loadTournamentProgress();
  const wins = { ...progress.wins };
  if (placement === 1 && wins[stageId] !== undefined) {
    wins[stageId] = (wins[stageId] ?? 0) + 1;
    recordStageWin(stageId);
    if (stageId === "world") {
      updateProgressAfterWorldChampClear();
    }
  }
  const bankroll = Math.max(0, (progress.bankroll ?? 0) + (prize ?? 0));
  const lastResult = {
    variant,
    stageId,
    placement,
    prize,
    feedback,
    reason,
    finishedAt: Date.now(),
  };
  const next = saveTournamentProgress({
    ...progress,
    wins,
    bankroll,
    completedTournaments: [
      ...(Array.isArray(progress.completedTournaments)
        ? progress.completedTournaments
        : []),
      normalizeCompletedTournamentEntry({
        variant,
        stageId,
        finishPlace: placement,
        tournamentId,
        completedAt: lastResult.finishedAt,
      }),
    ],
    lastResult,
  });
  appendTournamentHistory({
    variant,
    stageId,
    placement,
    prize,
    bankrollAfter: bankroll,
    feedback,
    reason,
    unlockedAdvancedModes: stageId === "world" && placement === 1,
  });
  return next;
}

export function summarizeTournamentHistory(history = getTournamentHistory()) {
  if (!history.length) {
    return { played: 0, itm: 0, roi: 0 };
  }
  const played = history.length;
  const itm = history.filter((h) => h.prize && h.prize > 0).length;
  const totalPrize = history.reduce((sum, h) => sum + (h.prize ?? 0), 0);
  const totalEntry = history.reduce((sum, h) => {
    const stage = getStageById(h.stageId);
    return sum + (stage?.entryFee ?? 0);
  }, 0);
  const roi = totalEntry ? ((totalPrize - totalEntry) / totalEntry) : 0;
  return { played, itmRate: itm / played, roi };
}

export function getStageDisplay(stageId) {
  const stage = getStageById(stageId);
  if (!stage) {
    return { label: "???", entryFee: 0 };
  }
  return {
    id: stage.id,
    label: stage.label,
    entryFee: stage.entryFee,
    participantsRange: stage.participantsRange,
    actionSeconds: stage.actionSeconds,
    timebankInitial: stage.timebankInitial,
    difficulty: stage.difficulty,
  };
}

export function randomParticipantCount(stageId) {
  const stage = getStageById(stageId);
  if (!stage) return 0;
  const [min, max] = stage.participantsRange;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function listUnlockedStages(progress = loadTournamentProgress()) {
  const wins = progress?.wins ?? {};
  return TOURNAMENT_STAGES.filter((stage) => getStageEligibility(stage.id, { wins }).eligible).map(
    (stage) => stage.id
  );
}
