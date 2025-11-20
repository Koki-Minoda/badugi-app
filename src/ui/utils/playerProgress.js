import { appendSystemEvent } from "./systemLog.js";

const STORAGE_KEY = "playerProgress";
const TOURNAMENT_STAGE_IDS = ["store", "local", "national", "world"];
const DEFAULT_STAGE_WINS = {
  store: 0,
  local: 0,
  national: 0,
  world: 0,
};
const DEFAULT_PROGRESS = {
  worldChampCleared: false,
  firstClearTimestamp: null,
  clearCount: 0,
  stageWins: { ...DEFAULT_STAGE_WINS },
  lastUnlockPopupAt: null,
};

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeStageWins(stageWins = {}) {
  return TOURNAMENT_STAGE_IDS.reduce(
    (acc, stageId) => {
      const numeric = Number(stageWins?.[stageId]);
      acc[stageId] = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
      return acc;
    },
    { ...DEFAULT_STAGE_WINS }
  );
}

function cloneProgress(progress = DEFAULT_PROGRESS) {
  if (!progress || typeof progress !== "object") {
    return { ...DEFAULT_PROGRESS, stageWins: { ...DEFAULT_STAGE_WINS } };
  }
  const normalizedStageWins = normalizeStageWins(
    progress.stageWins || progress.worldWins || progress?.worldChampionship?.stageWins
  );
  const clearedFlag =
    typeof progress.worldChampCleared === "boolean"
      ? progress.worldChampCleared
      : Boolean(progress?.worldChampionship?.unlocked);
  const firstClearTimestamp =
    typeof progress.firstClearTimestamp === "number"
      ? progress.firstClearTimestamp
      : typeof progress?.worldChampionship?.firstClearTimestamp === "number"
      ? progress.worldChampionship.firstClearTimestamp
      : null;
  const clearCountCandidate =
    Number.isFinite(progress.clearCount) && progress.clearCount >= 0
      ? progress.clearCount
      : Number.isFinite(progress?.worldChampionship?.clearCount)
      ? progress.worldChampionship.clearCount
      : 0;
  const lastUnlockPopupAt =
    typeof progress.lastUnlockPopupAt === "number"
      ? progress.lastUnlockPopupAt
      : typeof progress?.worldChampionship?.lastUnlockPopupAt === "number"
      ? progress.worldChampionship.lastUnlockPopupAt
      : null;
  return {
    worldChampCleared: Boolean(clearedFlag),
    firstClearTimestamp,
    clearCount: clearCountCandidate,
    stageWins: { ...normalizedStageWins },
    lastUnlockPopupAt,
  };
}

function broadcastProgress(progress) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("badugi:playerProgress-changed", { detail: progress })
  );
}

export function loadPlayerProgress() {
  if (!hasStorage()) return cloneProgress(DEFAULT_PROGRESS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneProgress(DEFAULT_PROGRESS);
    const parsed = JSON.parse(raw);
    return cloneProgress({ ...DEFAULT_PROGRESS, ...parsed });
  } catch (err) {
    console.warn("[PlayerProgress] Failed to load, resetting", err);
    return cloneProgress(DEFAULT_PROGRESS);
  }
}

export function savePlayerProgress(partialProgress) {
  const base = cloneProgress(loadPlayerProgress());
  const merged = {
    ...base,
    ...(partialProgress || {}),
    stageWins: normalizeStageWins(
      partialProgress?.stageWins !== undefined ? partialProgress.stageWins : base.stageWins
    ),
  };
  const normalized = cloneProgress(merged);
  if (hasStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (err) {
      console.warn("[PlayerProgress] Failed to save", err);
    }
  }
  broadcastProgress(normalized);
  return normalized;
}

export function resetPlayerProgress() {
  const next = cloneProgress(DEFAULT_PROGRESS);
  if (hasStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn("[PlayerProgress] Failed to reset", err);
    }
  }
  broadcastProgress(next);
  return next;
}

function describeChain(stageWins) {
  const labels = {
    store: "店舗優勝",
    local: "地方優勝",
    national: "全国優勝",
    world: "世界優勝",
  };
  const requirements = {
    store: 1,
    local: 1,
    national: 1,
    world: 1,
  };
  return TOURNAMENT_STAGE_IDS.map((stageId) => {
    const required = requirements[stageId] ?? 1;
    const current = stageWins[stageId] ?? 0;
    return {
      id: stageId,
      label: labels[stageId] ?? stageId,
      current,
      required,
      complete: current >= required,
      remaining: Math.max(0, required - current),
    };
  });
}

export function computeUnlockState(progress = loadPlayerProgress()) {
  const normalized = cloneProgress(progress);
  const chain = describeChain(normalized.stageWins);
  const unlocked = Boolean(normalized.worldChampCleared);
  const pendingStep = chain.find((step) => !step.complete);
  return {
    worldChampCleared: normalized.worldChampCleared,
    firstClearTimestamp: normalized.firstClearTimestamp,
    clearCount: normalized.clearCount,
    stageWins: { ...normalized.stageWins },
    chain,
    pendingStep: pendingStep ? pendingStep.id : null,
    mixedGameLocked: !unlocked,
    multiGameLocked: !unlocked,
    dealerChoiceLocked: !unlocked,
  };
}

export function recordStageWin(stageId) {
  if (!TOURNAMENT_STAGE_IDS.includes(stageId)) {
    return loadPlayerProgress();
  }
  const current = cloneProgress(loadPlayerProgress());
  const updatedWins = {
    ...current.stageWins,
    [stageId]: (current.stageWins?.[stageId] ?? 0) + 1,
  };
  return savePlayerProgress({
    ...current,
    stageWins: updatedWins,
  });
}

export function updateProgressAfterWorldChampClear() {
  const current = loadPlayerProgress();
  const wasCleared = current.worldChampCleared;
  const next = savePlayerProgress({
    ...current,
    worldChampCleared: true,
    firstClearTimestamp: current.firstClearTimestamp ?? Date.now(),
    clearCount: (current.clearCount ?? 0) + 1,
  });
  appendSystemEvent({
    type: wasCleared ? "WORLD_CHAMP_RECLEAR" : "WORLD_CHAMP_CLEAR",
    clearCount: next.clearCount,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("badugi:worldChampUnlocked", {
        detail: { progress: next, isFirstClear: !wasCleared },
      })
    );
  }
  return { progress: next, isFirstClear: !wasCleared };
}
