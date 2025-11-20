import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getVariantById,
  getEngineTemplateContext,
} from "../../games/config/variantCatalog.js";
import defaultProfiles from "../../config/mixed/mixedProfiles.json" assert { type: "json" };
import { PRO_MIXED_PRESETS } from "../../config/mixed/proPresets.js";
import { listEngines } from "../../games/core/engineRegistry.js";
import {
  loadMixedGameStateFromSession,
  persistMixedGameState,
} from "../tournament/tournamentManager.js";
import {
  buildProfileFromPreset,
  cloneProfile,
  findNextPlayableIndex,
  resolveInitialGame,
  advanceRotationState,
} from "./rotationUtils.js";

const STORAGE_KEY = "mixedGameProfiles";
const MixedGameContext = createContext(null);

const presetSource = [
  ...(Array.isArray(defaultProfiles) ? defaultProfiles : []),
  ...(Array.isArray(PRO_MIXED_PRESETS) ? PRO_MIXED_PRESETS : []),
];

const basePresetMap = new Map();
presetSource.forEach((preset) => {
  try {
    const built = buildProfileFromPreset(preset);
    basePresetMap.set(built.id, built);
  } catch (err) {
    console.warn("[MixedGame] Failed to ingest preset", preset?.id, err);
  }
});

if (!basePresetMap.size) {
  const fallback = buildProfileFromPreset({
    name: "Badugi Classic",
    selectedGameIds: ["D03"],
  });
  basePresetMap.set(fallback.id, fallback);
}

const basePresets = Array.from(basePresetMap.values());

const presetProfiles = basePresets.map(cloneProfile);

const presetProfilesClone = () => basePresets.map(cloneProfile);

const defaultProfileFactory = () =>
  cloneProfile(
    presetProfiles[0] ?? buildProfileFromPreset({ selectedGameIds: ["D03"] })
  );

function safeLoadProfiles() {
  if (typeof window === "undefined") {
    return presetProfilesClone();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return presetProfilesClone();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return presetProfilesClone();
    }
    return parsed.map(buildProfileFromPreset).map(cloneProfile);
  } catch (err) {
    console.warn("[MixedGame] Failed to load profiles", err);
    return presetProfilesClone();
  }
}

function persistProfiles(profiles) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.warn("[MixedGame] Failed to save profiles", err);
  }
}

const initialRuntimeState = {
  activeProfileId: null,
  activeGameId: null,
  selectionMode: "FIXED",
  currentIndex: 0,
  handsPlayedInCurrentGame: 0,
  handsPerGame: 0,
  history: [],
};

export function MixedGameProvider({ children }) {
  const [profiles, setProfiles] = useState(() => safeLoadProfiles());
  const [runtimeState, setRuntimeState] = useState(initialRuntimeState);

  const playableEngines = useMemo(() => new Set(listEngines()), []);
  const isVariantPlayable = (gameId) => {
    if (!gameId) return false;
    const ctx = getEngineTemplateContext(gameId);
    if (!ctx?.engineId) return false;
    return playableEngines.has(ctx.engineId);
  };

  const persistMixedRuntime = (nextState, profile) => {
    if (!nextState || !profile) return;
    persistMixedGameState({
      profileId: profile.id,
      profileName: profile.name,
      formatLabel: profile.formatLabel,
      selectionMode: nextState.selectionMode,
      handsPerGame: nextState.handsPerGame,
      currentIndex: nextState.currentIndex,
      activeGameId: nextState.activeGameId,
      handsPlayedInCurrentGame: nextState.handsPlayedInCurrentGame,
      history: nextState.history ?? [],
    });
  };

  const saveProfile = (draft) => {
    const now = Date.now();
    const payload = buildProfileFromPreset({
      ...draft,
      id: draft.id,
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
    });
    const nextProfiles = profiles.some((p) => p.id === payload.id)
      ? profiles.map((p) => (p.id === payload.id ? payload : p))
      : [...profiles, payload];
    setProfiles(nextProfiles);
    persistProfiles(nextProfiles);
    return payload;
  };

  const deleteProfile = (profileId) => {
    const next = profiles.filter((p) => p.id !== profileId);
    const normalized =
      next.length > 0 ? next : presetProfilesClone();
    setProfiles(normalized);
    persistProfiles(normalized);
    if (runtimeState.activeProfileId === profileId) {
      setRuntimeState(initialRuntimeState);
    }
  };

  const getProfileById = (profileId) => profiles.find((p) => p.id === profileId) ?? null;

  const activateProfile = (profileId) => {
    const profile = getProfileById(profileId);
    if (!profile || profile.selectedGameIds.length === 0) return null;
    const resolved = resolveInitialGame(profile, null, isVariantPlayable);
    if (!resolved?.gameId) {
      console.warn("[MixedGame] No playable game in selected profile", profileId);
      return null;
    }
    const nextState = {
      activeProfileId: profile.id,
      activeGameId: resolved.gameId,
      selectionMode: profile.selectionMode,
      currentIndex: resolved.index ?? 0,
      handsPlayedInCurrentGame: 0,
      handsPerGame: profile.handsPerGame,
      history: [],
    };
    setRuntimeState(nextState);
    persistMixedRuntime(nextState, profile);
    return { profile, gameId: resolved.gameId };
  };

  const deactivateMixedGame = () => {
    setRuntimeState(initialRuntimeState);
    persistMixedGameState(null);
  };

  const handleHandCompletion = () => {
    if (!runtimeState.activeProfileId) return null;
    const profile = getProfileById(runtimeState.activeProfileId);
    if (!profile || profile.selectedGameIds.length === 0) {
      setRuntimeState(initialRuntimeState);
      persistMixedGameState(null);
      return null;
    }

    const rotationResult = advanceRotationState(
      runtimeState,
      profile,
      isVariantPlayable
    );

    const history = Array.isArray(runtimeState.history) ? [...runtimeState.history] : [];
    if (runtimeState.activeGameId) {
      history.push(runtimeState.activeGameId);
    }
    const trimmedHistory = history.slice(history.length > 50 ? history.length - 50 : 0);
    const nextState = {
      ...rotationResult.nextState,
      history: trimmedHistory,
    };

    setRuntimeState(nextState);
    persistMixedRuntime(nextState, profile);

    return {
      rotated: rotationResult.rotated,
      previousGameId: rotationResult.previousGameId,
      nextGameId: rotationResult.nextGameId,
      profile,
      handsPerGame: profile.handsPerGame,
      selectionMode:
        rotationResult.nextState.selectionMode ?? profile.selectionMode,
      handsPlayedInCurrentGame:
        rotationResult.nextState.handsPlayedInCurrentGame,
      history: trimmedHistory,
    };
  };

  const activeProfile = runtimeState.activeProfileId
    ? getProfileById(runtimeState.activeProfileId)
    : null;
  const activeVariant = runtimeState.activeGameId
    ? getVariantById(runtimeState.activeGameId)
    : null;
  const templateContext = runtimeState.activeGameId
    ? getEngineTemplateContext(runtimeState.activeGameId)
    : null;

  const activeEngineId =
    templateContext?.engineId && playableEngines.has(templateContext.engineId)
      ? templateContext.engineId
      : null;

  const remainingHands =
    runtimeState.handsPerGame > 0
      ? Math.max(
          0,
          runtimeState.handsPerGame - runtimeState.handsPlayedInCurrentGame
        )
      : 0;

  useEffect(() => {
    if (runtimeState.activeProfileId || typeof window === "undefined") return;
    const stored = loadMixedGameStateFromSession();
    if (!stored?.profileId) return;
    const profile = getProfileById(stored.profileId);
    if (!profile) return;
    const fallbackIndex = findNextPlayableIndex(profile, 0, isVariantPlayable);
    const fallbackGameId =
      fallbackIndex != null ? profile.selectedGameIds[fallbackIndex] : null;
    const activeGameId = stored.activeGameId && isVariantPlayable(stored.activeGameId)
      ? stored.activeGameId
      : fallbackGameId;
    if (!activeGameId) return;
    const nextState = {
      activeProfileId: profile.id,
      activeGameId,
      selectionMode: stored.selectionMode ?? profile.selectionMode,
      currentIndex:
        typeof stored.currentIndex === "number"
          ? stored.currentIndex
          : fallbackIndex ?? 0,
      handsPlayedInCurrentGame: stored.handsPlayedInCurrentGame ?? 0,
      handsPerGame: stored.handsPerGame ?? profile.handsPerGame,
      history: Array.isArray(stored.history) ? stored.history : [],
    };
    setRuntimeState(nextState);
  }, [runtimeState.activeProfileId, profiles]);

  const value = useMemo(
    () => ({
      profiles,
      saveProfile,
      deleteProfile,
      activateProfile,
      deactivateMixedGame,
      proPresets: PRO_MIXED_PRESETS,
      activeProfile,
      activeProfileFormat: activeProfile?.formatLabel ?? null,
      activeProfileId: runtimeState.activeProfileId,
      activeGameId: runtimeState.activeGameId,
      activeVariant,
      activeEngineId,
      runtimeState,
      rotationHistory: runtimeState.history ?? [],
      isMixedMode: Boolean(runtimeState.activeProfileId),
      handleHandCompletion,
      remainingHands,
      isVariantPlayable,
      playableEngines,
    }),
    [
      profiles,
      runtimeState,
      activeProfile,
      activeVariant,
      activeEngineId,
      remainingHands,
      playableEngines,
      isVariantPlayable,
    ]
  );

  return <MixedGameContext.Provider value={value}>{children}</MixedGameContext.Provider>;
}

export function useMixedGame() {
  const ctx = useContext(MixedGameContext);
  if (!ctx) {
    throw new Error("useMixedGame must be used within MixedGameProvider");
  }
  return ctx;
}




