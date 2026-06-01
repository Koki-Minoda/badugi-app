import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { usePlayerProgress } from "../usePlayerProgress.js";
import {
  createDefaultConsolidatedProgress,
  saveConsolidatedProgress,
} from "../../utils/consolidatedProgress.js";

function saveV2Progress(overrides = {}) {
  const defaults = createDefaultConsolidatedProgress();
  return saveConsolidatedProgress({
    ...defaults,
    ...overrides,
    tournament: {
      ...defaults.tournament,
      ...(overrides.tournament ?? {}),
    },
    career: {
      ...defaults.career,
      ...(overrides.career ?? {}),
      worldChampionship: {
        ...defaults.career.worldChampionship,
        ...(overrides.career?.worldChampionship ?? {}),
      },
    },
  });
}

describe("usePlayerProgress", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reads stage wins from consolidated v2", () => {
    saveV2Progress({
      tournament: {
        stageWins: { store: 1, local: 2, national: 3, world: 4 },
      },
    });

    const { result } = renderHook(() => usePlayerProgress());

    expect(result.current.stageWins).toEqual({
      store: 1,
      local: 2,
      national: 3,
      world: 4,
    });
  });

  it("reads world champion state from consolidated v2", () => {
    saveV2Progress({
      career: {
        worldChampionship: {
          cleared: true,
          firstClearTimestamp: 123,
          clearCount: 2,
          lastUnlockPopupAt: 456,
        },
      },
    });

    const { result } = renderHook(() => usePlayerProgress());

    expect(result.current).toMatchObject({
      worldChampCleared: true,
      firstClearTimestamp: 123,
      clearCount: 2,
      lastUnlockPopupAt: 456,
    });
  });

  it("reloads consolidated progress after player progress events", async () => {
    saveV2Progress({
      tournament: {
        stageWins: { store: 0, local: 0, national: 0, world: 0 },
      },
    });
    const { result } = renderHook(() => usePlayerProgress());

    saveV2Progress({
      tournament: {
        stageWins: { store: 0, local: 1, national: 0, world: 0 },
      },
      career: {
        worldChampionship: { cleared: true, clearCount: 1 },
      },
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("badugi:worldChampUnlocked"));
    });

    await waitFor(() => {
      expect(result.current.stageWins.local).toBe(1);
      expect(result.current.worldChampCleared).toBe(true);
    });
  });
});
