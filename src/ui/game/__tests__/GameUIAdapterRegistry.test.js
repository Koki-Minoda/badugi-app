import { beforeEach, describe, expect, it } from "vitest";
import {
  registerGameUIAdapter,
  getGameUIAdapter,
  getRegisteredGameUIAdapters,
  clearGameUIAdapters,
} from "../GameUIAdapterRegistry.js";

class DummyAdapter {}

describe("GameUIAdapterRegistry", () => {
  beforeEach(() => {
    clearGameUIAdapters();
  });

  it("registers and retrieves adapters by variant id", () => {
    const adapter = new DummyAdapter();
    registerGameUIAdapter("dummy", adapter);
    expect(getGameUIAdapter("dummy")).toBe(adapter);
  });

  it("allows later registrations to overwrite the same variant id", () => {
    const adapterA = new DummyAdapter();
    const adapterB = new DummyAdapter();
    registerGameUIAdapter("dummy", adapterA);
    registerGameUIAdapter("dummy", adapterB);
    expect(getGameUIAdapter("dummy")).toBe(adapterB);
  });

  it("returns undefined for unknown variants", () => {
    expect(getGameUIAdapter("missing-variant")).toBeUndefined();
  });

  it("exposes the set of registered adapters", () => {
    registerGameUIAdapter("a", new DummyAdapter());
    registerGameUIAdapter("b", new DummyAdapter());
    const entries = getRegisteredGameUIAdapters();
    const ids = entries.map((entry) => entry.variantId).sort();
    expect(ids).toEqual(["a", "b"]);
    expect(entries.every((entry) => entry.adapter instanceof DummyAdapter)).toBe(true);
  });
});
