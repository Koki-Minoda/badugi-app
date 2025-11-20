import { describe, expect, it, vi } from "vitest";
import {
  buildProfileFromPreset,
  resolveInitialGame,
  advanceRotationState,
  findNextPlayableIndex,
} from "../../mixed/rotationUtils.js";

const playable = (id) => id !== "X99";

describe("rotationUtils", () => {
  it("resolves initial game to first playable entry", () => {
    const profile = buildProfileFromPreset({
      selectedGameIds: ["X99", "D03", "D05"],
      selectionMode: "FIXED",
    });
    const resolved = resolveInitialGame(profile, null, playable);
    expect(resolved).toEqual({ gameId: "D03", index: 1 });
  });

  it("resolves initial game randomly when mode is RANDOM", () => {
    const profile = buildProfileFromPreset({
      selectedGameIds: ["D01", "D02", "D03"],
      selectionMode: "RANDOM",
    });
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.6); // pick index 1
    const resolved = resolveInitialGame(profile, null, playable);
    expect(resolved?.gameId).toBeDefined();
    vi.restoreAllMocks();
  });

  it("finds next playable index with wrap-around", () => {
    const profile = buildProfileFromPreset({
      selectedGameIds: ["X99", "D01", "D02"],
    });
    const idx = findNextPlayableIndex(profile, 0, playable);
    expect(idx).toBe(1);
    const wrapped = findNextPlayableIndex(profile, 2, playable);
    expect(wrapped).toBe(2);
  });

  it("rotates to next game after required hands", () => {
    const profile = buildProfileFromPreset({
      selectedGameIds: ["D01", "D02", "D03"],
      handsPerGame: 2,
      selectionMode: "FIXED",
    });
    const runtimeState = {
      activeProfileId: "mix-1",
      activeGameId: "D01",
      selectionMode: "FIXED",
      currentIndex: 0,
      handsPlayedInCurrentGame: 1,
      handsPerGame: 2,
    };
    const result = advanceRotationState(runtimeState, profile, playable);
    expect(result.rotated).toBe(true);
    expect(result.nextState.activeGameId).toBe("D02");
    expect(result.nextState.handsPlayedInCurrentGame).toBe(0);
  });

  it("keeps current game if no playable variant is available", () => {
    const profile = buildProfileFromPreset({
      selectedGameIds: ["X99"],
      handsPerGame: 1,
      selectionMode: "FIXED",
    });
    const runtimeState = {
      activeProfileId: "mix-2",
      activeGameId: "X99",
      selectionMode: "FIXED",
      currentIndex: 0,
      handsPlayedInCurrentGame: 0,
      handsPerGame: 1,
    };
    const result = advanceRotationState(runtimeState, profile, playable);
    expect(result.rotated).toBe(false);
    expect(result.nextState.activeGameId).toBe("X99");
  });

  it("random rotation selects only playable IDs", () => {
    const profile = buildProfileFromPreset({
      selectedGameIds: ["X99", "D04"],
      handsPerGame: 1,
      selectionMode: "RANDOM",
    });
    const runtimeState = {
      activeProfileId: "mix-3",
      activeGameId: "D04",
      selectionMode: "RANDOM",
      currentIndex: 1,
      handsPlayedInCurrentGame: 0,
      handsPerGame: 1,
    };
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const result = advanceRotationState(runtimeState, profile, playable);
    expect(result.rotated).toBe(true);
    expect(result.nextState.activeGameId).toBe("D04");
    vi.restoreAllMocks();
  });
});
