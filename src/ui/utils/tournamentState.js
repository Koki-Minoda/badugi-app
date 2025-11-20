import { getStageById, TOURNAMENT_STAGES } from "../../config/tournamentStages";
import { recordStageWin, updateProgressAfterWorldChampClear } from "./playerProgress";

const PROGRESS_KEY = "progress.tournament";
const HISTORY_KEY = "history.tournaments";

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
  lastResult: null,
};

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadTournamentProgress() {
  if (!hasStorage()) return clone(DEFAULT_PROGRESS);
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return clone(DEFAULT_PROGRESS);
    const parsed = JSON.parse(raw);
    return {
      ...clone(DEFAULT_PROGRESS),
      ...parsed,
      wins: { ...clone(DEFAULT_PROGRESS).wins, ...(parsed?.wins ?? {}) },
    };
  } catch (err) {
    console.warn("Failed to load tournament progress:", err);
    return clone(DEFAULT_PROGRESS);
  }
}

export function saveTournamentProgress(progress) {
  if (!hasStorage()) return progress;
  const next = {
    ...clone(DEFAULT_PROGRESS),
    ...progress,
    wins: { ...clone(DEFAULT_PROGRESS).wins, ...(progress?.wins ?? {}) },
  };
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  return next;
}

export function resetTournamentProgress() {
  if (!hasStorage()) return clone(DEFAULT_PROGRESS);
  window.localStorage.removeItem(PROGRESS_KEY);
  return clone(DEFAULT_PROGRESS);
}

export function getTournamentHistory() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Failed to load tournament history:", err);
    return [];
  }
}

export function appendTournamentHistory(entry) {
  if (!hasStorage()) return [];
  const history = getTournamentHistory();
  const next = [
    {
      id: entry?.id ?? randomId("tourney"),
      timestamp: Date.now(),
      ...entry,
    },
    ...history,
  ].slice(0, 200);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
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

export function applyTournamentResult({ stageId, placement, prize = 0, feedback, reason }) {
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
    lastResult,
  });
  appendTournamentHistory({
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
