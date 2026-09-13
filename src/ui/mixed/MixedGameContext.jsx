import { isMixedVariantPlayable } from "./mixedAvailability.js";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  getVariantById,
  getEngineTemplateContext,
} from "../../games/config/variantCatalog.js";
import defaultProfiles from "../../config/mixed/mixedProfiles.json";
import { PRO_MIXED_PRESETS } from "../../config/mixed/proPresets.js";
import { listEngines } from "../../games/core/engineRegistry.js";
import {
  buildProfileFromPreset,
  cloneProfile,
  resolveInitialGame,
  advanceRotationState,
} from "./rotationUtils.js";
import { MixedGameContext } from "./mixedGameContext.js";

const STORAGE_KEY = "mixedGameProfiles";

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

const presetProfilesClone = () => basePresets.map(cloneProfile);

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

  const runtimeRef = useRef(initialRuntimeState);
  const sessionProfileRef = useRef(null);
  const updateRuntime = useCallback((nextState) => {
    runtimeRef.current = nextState;
    setRuntimeState(nextState);
  }, []);

  const playableEngines = useMemo(() => new Set(listEngines()), []);
  const isVariantPlayable = isMixedVariantPlayable;

  const saveProfile = useCallback((draft) => {
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
  }, [profiles]);

  const deleteProfile = useCallback((profileId) => {
    const next = profiles.filter((p) => p.id !== profileId);
    const normalized =
      next.length > 0 ? next : presetProfilesClone();
    setProfiles(normalized);
    persistProfiles(normalized);
    if (runtimeState.activeProfileId === profileId) {
      updateRuntime(initialRuntimeState);
    }
  }, [profiles, runtimeState.activeProfileId, updateRuntime]);

  const getProfileById = useCallback(
    (profileId) => profiles.find((p) => p.id === profileId) ?? null,
    [profiles]
  );

  const activateProfile = useCallback((profileId) => {
    const profile = typeof profileId === "object" ? buildProfileFromPreset(profileId) : getProfileById(profileId);
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
    sessionProfileRef.current = cloneProfile(profile);
    updateRuntime(nextState);
    return { profile, gameId: resolved.gameId };
  }, [getProfileById, isVariantPlayable, updateRuntime]);

  const deactivateMixedGame = useCallback(() => {
    updateRuntime(initialRuntimeState);
    sessionProfileRef.current = null;
  }, [updateRuntime]);

  const handleHandCompletion = useCallback((handId) => {
    const current = runtimeRef.current;
    if (!current.activeProfileId || !handId || current.lastCompletedHandId === handId) return null;
    const profile = sessionProfileRef.current ?? getProfileById(current.activeProfileId);
    if (!profile) return null;
    const result = advanceRotationState(current, profile, isVariantPlayable);
    const nextState = {
      ...result.nextState,
      lastCompletedHandId: handId,
      history: [...(current.history ?? []), current.activeGameId].slice(-50),
    };
    updateRuntime(nextState);
    return { ...result, nextState, profile };
  }, [getProfileById, isVariantPlayable, updateRuntime]);

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
      saveProfile,
      deleteProfile,
      activateProfile,
      deactivateMixedGame,
      handleHandCompletion,
    ]
  );

  return <MixedGameContext.Provider value={value}>{children}</MixedGameContext.Provider>;
}


