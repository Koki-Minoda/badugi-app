import { describe, expect, it } from "vitest";

import {
  COACHING_PREVIEW_STORAGE_KEY,
  isCoachingPreviewEnabled,
  setCoachingPreviewFlag,
} from "../previewFeatureFlags.js";

function memoryStorage({ throws = false } = {}) {
  const map = new Map();
  return {
    getItem(key) {
      if (throws) throw new Error("unavailable");
      return map.get(key) ?? null;
    },
    setItem(key, value) {
      if (throws) throw new Error("unavailable");
      map.set(key, value);
    },
    removeItem(key) {
      if (throws) throw new Error("unavailable");
      map.delete(key);
    },
  };
}

describe("preview feature flags", () => {
  it("keeps coaching preview off by default", () => {
    expect(isCoachingPreviewEnabled({ env: {}, search: "", storage: null })).toBe(false);
  });

  it("enables coaching preview from env, query, or storage", () => {
    expect(isCoachingPreviewEnabled({ env: { VITE_MGX_COACHING_PREVIEW: "true" }, search: "", storage: null })).toBe(true);
    expect(isCoachingPreviewEnabled({ env: {}, search: "?mgxPreview=coaching", storage: null })).toBe(true);
    const storage = memoryStorage();
    storage.setItem(COACHING_PREVIEW_STORAGE_KEY, "true");
    expect(isCoachingPreviewEnabled({ env: {}, search: "", storage })).toBe(true);
  });

  it("does not crash when storage is unavailable", () => {
    const storage = memoryStorage({ throws: true });
    expect(isCoachingPreviewEnabled({ env: {}, search: "", storage })).toBe(false);
    expect(setCoachingPreviewFlag(true, storage)).toEqual(
      expect.objectContaining({ previewOnly: true, persisted: false }),
    );
  });
});
