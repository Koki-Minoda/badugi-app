import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeUnlockState,
  loadPlayerProgress,
  recordStageWin,
  resetPlayerProgress,
  updateProgressAfterWorldChampClear,
} from "../playerProgress.js";
import { STORAGE_KEYS } from "../../../storage/keys.js";

describe("playerProgress helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads default player progress through storage fallback", () => {
    expect(loadPlayerProgress()).toMatchObject({
      worldChampCleared: false,
      firstClearTimestamp: null,
      clearCount: 0,
      stageWins: { store: 0, local: 0, national: 0, world: 0 },
      lastUnlockPopupAt: null,
    });
  });

  it("computes unlock chain with pending steps", () => {
    const unlock = computeUnlockState({
      worldChampCleared: false,
      clearCount: 0,
      firstClearTimestamp: null,
      stageWins: { store: 1, local: 0, national: 0, world: 0 },
    });
    expect(unlock.chain).toHaveLength(4);
    expect(unlock.chain[0].complete).toBe(true);
    expect(unlock.chain[1].complete).toBe(false);
    expect(unlock.pendingStep).toBe("local");
    expect(unlock.mixedGameLocked).toBe(true);
  });

  it("increments stage wins when recording a victory", () => {
    const progress = recordStageWin("store");
    expect(progress.stageWins.store).toBe(1);
    expect(progress.stageWins.local).toBe(0);
  });

  it("marks world championship clears", () => {
    const { progress, isFirstClear } = updateProgressAfterWorldChampClear();
    expect(progress.worldChampCleared).toBe(true);
    expect(progress.clearCount).toBeGreaterThan(0);
    expect(typeof isFirstClear).toBe("boolean");
  });

  it("dispatches player progress changed events", () => {
    const eventSpy = vi.fn();
    window.addEventListener("badugi:playerProgress-changed", eventSpy);

    resetPlayerProgress();

    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          stageWins: { store: 0, local: 0, national: 0, world: 0 },
        }),
      }),
    );
    window.removeEventListener("badugi:playerProgress-changed", eventSpy);
  });

  it("dispatches world champion unlock events", () => {
    const eventSpy = vi.fn();
    window.addEventListener("badugi:worldChampUnlocked", eventSpy);

    updateProgressAfterWorldChampClear();

    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          isFirstClear: true,
          progress: expect.objectContaining({ worldChampCleared: true }),
        }),
      }),
    );
    window.removeEventListener("badugi:worldChampUnlocked", eventSpy);
  });

  it("falls back safely when player progress storage is corrupted", () => {
    window.localStorage.setItem(STORAGE_KEYS.PLAYER_PROGRESS, "{bad json");

    expect(() => loadPlayerProgress()).not.toThrow();
    expect(loadPlayerProgress()).toMatchObject({
      worldChampCleared: false,
      stageWins: { store: 0, local: 0, national: 0, world: 0 },
    });
  });
});
