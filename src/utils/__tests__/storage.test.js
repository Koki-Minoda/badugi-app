import { beforeEach, describe, expect, it, vi } from "vitest";

import { getJSON, pushToArray } from "../storage.js";

describe("pushToArray", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("keeps the newest entries and evicts complete oldest entries on quota pressure", () => {
    localStorage.setItem(
      "badugi.hands",
      JSON.stringify([{ id: "oldest" }, { id: "older" }]),
    );
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function setItem(key, value) {
      const parsed = JSON.parse(value);
      if (key === "badugi.hands" && parsed.length > 2) {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    });

    const result = pushToArray("hands", { id: "newest" });

    expect(result.map(({ id }) => id)).toEqual(["newest", "oldest"]);
    expect(getJSON("hands").map(({ id }) => id)).toEqual(["newest", "oldest"]);
  });

  it("surfaces quota failure when even the newest entry cannot be saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });

    expect(() => pushToArray("hands", { id: "newest" })).toThrow("quota exceeded");
  });
});
