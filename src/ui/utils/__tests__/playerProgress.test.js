import { describe, expect, it } from "vitest";
import {
  computeUnlockState,
  recordStageWin,
  updateProgressAfterWorldChampClear,
} from "../playerProgress.js";

describe("playerProgress helpers", () => {
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
});
