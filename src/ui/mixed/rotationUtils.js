import {
  GAME_VARIANTS,
  GAME_VARIANT_CATEGORIES,
  getVariantById,
} from "../../games/config/variantCatalog.js";

const CATEGORY_KEYS = Object.values(GAME_VARIANT_CATEGORIES);

const CATEGORY_VARIANT_MAP = CATEGORY_KEYS.reduce((acc, category) => {
  acc[category] = GAME_VARIANTS.filter((variant) => variant.category === category).map(
    (variant) => variant.id
  );
  return acc;
}, {});

const clampHands = (value) => Math.max(1, Math.min(30, Number(value) || 4));

const normalizeList = (list) =>
  Array.isArray(list)
    ? Array.from(new Set(list.filter((item) => typeof item === "string" && item.trim()))).map(
        (item) => item.trim()
      )
    : [];

function sanitizeWeightedTable(table = {}, selectedIds = []) {
  const normalized = {};
  Object.entries(table || {}).forEach(([gameId, weight]) => {
    const numeric = Number(weight);
    if (!gameId || Number.isNaN(numeric) || numeric <= 0) return;
    normalized[gameId] = numeric;
  });
  selectedIds.forEach((id) => {
    if (normalized[id] == null) {
      normalized[id] = 1;
    }
  });
  return normalized;
}

function sanitizeCategoryRules(rules = {}) {
  const weights = { ...rules.weights };
  CATEGORY_KEYS.forEach((category) => {
    const numeric = Number(weights?.[category]);
    weights[category] = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  });
  const pools = {};
  Object.entries(rules.pools || {}).forEach(([category, ids]) => {
    if (!CATEGORY_KEYS.includes(category)) return;
    pools[category] = normalizeList(ids);
  });
  return {
    weights,
    pools,
  };
}

function ensureSelectedIds(baseIds = [], weightedTable = {}) {
  const set = new Set(baseIds);
  Object.keys(weightedTable || {}).forEach((id) => {
    set.add(id);
  });
  return Array.from(set).slice(0, 20);
}

export function buildProfileFromPreset(preset = {}) {
  const selectedIds = Array.isArray(preset.selectedGameIds)
    ? preset.selectedGameIds.slice(0, 20)
    : ["D03"];
  const allowDuplicates =
    preset.allowDuplicates === undefined ? true : Boolean(preset.allowDuplicates);
  const baseSelected = allowDuplicates ? selectedIds : normalizeList(selectedIds);
  const sanitizedWeights = sanitizeWeightedTable(preset.weightedTable, baseSelected);
  const normalizedIds = ensureSelectedIds(baseSelected, sanitizedWeights);

  return {
    id: preset.id ?? `mix-${Math.random().toString(36).slice(2)}`,
    name: preset.name ?? "Mixed Game",
    formatLabel: preset.formatLabel ?? preset.name ?? "Mixed Game",
    description: preset.description ?? "",
    selectedGameIds: normalizedIds,
    selectionMode: normalizeSelectionMode(preset.selectionMode),
    handsPerGame: clampHands(preset.handsPerGame),
    allowDuplicates,
    weightedTable: sanitizedWeights,
    categoryRules: sanitizeCategoryRules(preset.categoryRules),
    hardBans: normalizeList(preset.hardBans),
    softBans: normalizeList(preset.softBans),
    createdAt: typeof preset.createdAt === "number" ? preset.createdAt : Date.now(),
    updatedAt: typeof preset.updatedAt === "number" ? preset.updatedAt : Date.now(),
  };
}

export function cloneProfile(profile) {
  if (!profile) return null;
  return {
    ...profile,
    selectedGameIds: Array.isArray(profile.selectedGameIds)
      ? [...profile.selectedGameIds]
      : [],
    weightedTable: { ...(profile.weightedTable || {}) },
    categoryRules: {
      weights: { ...(profile.categoryRules?.weights || {}) },
      pools: Object.keys(profile.categoryRules?.pools || {}).reduce((acc, key) => {
        acc[key] = [...profile.categoryRules.pools[key]];
        return acc;
      }, {}),
    },
    hardBans: [...(profile.hardBans || [])],
    softBans: [...(profile.softBans || [])],
  };
}

function normalizeSelectionMode(mode) {
  if (mode === "RANDOM" || mode === "WEIGHTED" || mode === "CATEGORY") {
    return mode;
  }
  return "FIXED";
}

export function findNextPlayableIndex(profile, startIndex, isPlayable) {
  if (!profile || !Array.isArray(profile.selectedGameIds)) return null;
  if (profile.selectedGameIds.length === 0) return null;
  const total = profile.selectedGameIds.length;
  for (let offset = 0; offset < total; offset += 1) {
    const idx = (startIndex + offset) % total;
    const gameId = profile.selectedGameIds[idx];
    if (!isPlayable || isPlayable(gameId)) {
      return idx;
    }
  }
  return null;
}

export function resolveInitialGame(profile, selectionModeOverride, isPlayable) {
  if (!profile || profile.selectedGameIds.length === 0) return null;
  const mode = normalizeSelectionMode(selectionModeOverride || profile.selectionMode);
  if (mode === "RANDOM") {
    const playableIds = profile.selectedGameIds.filter((id) =>
      isPlayable ? isPlayable(id) : true
    );
    if (playableIds.length === 0) return null;
    const nextId = pickRandom(playableIds);
    return {
      gameId: nextId,
      index: profile.selectedGameIds.indexOf(nextId),
    };
  }
  if (mode === "WEIGHTED") {
    const nextId = pickWeightedGame(profile, isPlayable);
    if (!nextId) return null;
    return {
      gameId: nextId,
      index: profile.selectedGameIds.indexOf(nextId),
    };
  }
  if (mode === "CATEGORY") {
    const nextId = pickCategoryGame(profile, isPlayable);
    if (!nextId) return null;
    return {
      gameId: nextId,
      index: profile.selectedGameIds.indexOf(nextId),
    };
  }
  const idx = findNextPlayableIndex(profile, 0, isPlayable);
  if (idx == null) return null;
  return { gameId: profile.selectedGameIds[idx], index: idx };
}

export function advanceRotationState(runtimeState, profile, isPlayable) {
  if (!runtimeState || !profile) {
    return {
      rotated: false,
      nextState: runtimeState,
      previousGameId: runtimeState?.activeGameId ?? null,
      nextGameId: runtimeState?.activeGameId ?? null,
    };
  }
  let handsPlayed = (runtimeState.handsPlayedInCurrentGame ?? 0) + 1;
  let rotated = false;
  let nextIndex = runtimeState.currentIndex ?? 0;
  let nextGameId = runtimeState.activeGameId ?? null;
  const previousGameId = runtimeState.activeGameId ?? null;
  const mode = normalizeSelectionMode(profile.selectionMode);

  if (profile.handsPerGame > 0 && handsPlayed >= profile.handsPerGame) {
    handsPlayed = 0;
    rotated = true;
    if (mode === "FIXED") {
      const candidate = findNextPlayableIndex(
        profile,
        (runtimeState.currentIndex ?? 0) + 1,
        isPlayable
      );
      if (candidate != null) {
        nextIndex = candidate;
        nextGameId = profile.selectedGameIds[nextIndex];
      } else {
        rotated = false;
      }
    } else if (mode === "RANDOM") {
      const playableIds = profile.selectedGameIds.filter((id) =>
        isPlayable ? isPlayable(id) : true
      );
      if (playableIds.length > 0) {
        nextGameId = pickRandom(playableIds);
        nextIndex = profile.selectedGameIds.indexOf(nextGameId);
      } else {
        rotated = false;
      }
    } else if (mode === "WEIGHTED") {
      const nextId = pickWeightedGame(profile, isPlayable);
      if (nextId) {
        nextGameId = nextId;
        nextIndex = profile.selectedGameIds.indexOf(nextId);
      } else {
        rotated = false;
      }
    } else if (mode === "CATEGORY") {
      const nextId = pickCategoryGame(profile, isPlayable);
      if (nextId) {
        nextGameId = nextId;
        nextIndex = profile.selectedGameIds.indexOf(nextId);
      } else {
        rotated = false;
      }
    }
  }

  const nextState = {
    ...runtimeState,
    selectionMode: mode,
    activeGameId: nextGameId,
    currentIndex: nextIndex,
    handsPlayedInCurrentGame: handsPlayed,
    handsPerGame: profile.handsPerGame,
  };

  return {
    rotated,
    previousGameId,
    nextGameId,
    nextState,
  };
}

function pickWeightedGame(profile, isPlayable) {
  const entries = [];
  const table = profile.weightedTable || {};
  const hardBans = new Set(profile.hardBans || []);
  const softBans = new Set(profile.softBans || []);
  const ids = profile.selectedGameIds.length ? profile.selectedGameIds : Object.keys(table);
  ids.forEach((gameId) => {
    if (!gameId || hardBans.has(gameId)) return;
    if (isPlayable && !isPlayable(gameId)) return;
    const baseWeight = Number(table[gameId] ?? 1);
    if (!(baseWeight > 0)) return;
    const weight = softBans.has(gameId) ? baseWeight * 0.25 : baseWeight;
    entries.push({ gameId, weight });
  });
  return selectByWeight(entries);
}

function pickCategoryGame(profile, isPlayable) {
  const rules = profile.categoryRules || {};
  const weightsEntries = Object.entries(rules.weights || {}).filter(([, weight]) => weight > 0);
  if (!weightsEntries.length) return null;
  const category = selectByWeight(
    weightsEntries.map(([cat, weight]) => ({ gameId: cat, weight }))
  );
  if (!category) return null;
  const pool =
    (rules.pools && rules.pools[category] && rules.pools[category].length
      ? rules.pools[category]
      : null) ??
    CATEGORY_VARIANT_MAP[category] ??
    [];
  if (!pool.length) return null;
  const hardBans = new Set(profile.hardBans || []);
  const softBans = new Set(profile.softBans || []);
  const entries = pool
    .filter(Boolean)
    .filter((gameId) => !hardBans.has(gameId))
    .filter((gameId) => (!isPlayable ? true : isPlayable(gameId)))
    .map((gameId) => ({
      gameId,
      weight: softBans.has(gameId) ? 0.25 : 1,
    }));
  return selectByWeight(entries);
}

function selectByWeight(entries = []) {
  if (!entries.length) return null;
  const total = entries.reduce((sum, entry) => sum + (entry.weight || 0), 0);
  if (total <= 0) return null;
  let cursor = Math.random() * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.gameId;
    }
  }
  return entries[entries.length - 1].gameId;
}

function pickRandom(list) {
  if (!list.length) return null;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}
