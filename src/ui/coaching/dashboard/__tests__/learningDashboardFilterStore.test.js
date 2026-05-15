import { describe, expect, it } from "vitest";

import { createLearningDashboardFilterStore } from "../learningDashboardFilterStore.js";

describe("createLearningDashboardFilterStore", () => {
  it("stores selected variant locally and falls back safely", () => {
    const storage = new Map();
    const localStorageLike = {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    };
    const store = createLearningDashboardFilterStore({ storage: localStorageLike, availableVariants: ["S02"] });
    expect(store.setSelectedVariant("S02")).toBe("S02");
    expect(store.setSelectedVariant("D02")).toBe("all");
    expect(store.exportPreview().networkTelemetry).toBe(false);
  });

  it("does not crash when localStorage writes are unavailable", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createLearningDashboardFilterStore({ storage, availableVariants: ["S02"] });
    expect(store.setSelectedVariant("S02")).toBe("S02");
    expect(store.exportPreview().networkTelemetry).toBe(false);
  });
});
