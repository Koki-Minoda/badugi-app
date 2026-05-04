import { describe, expect, it } from "vitest";
import { clearGameUIAdapters, getGameUIAdapter } from "../../GameUIAdapterRegistry.js";
import {
  DramahaUIAdapter,
  ensureDramahaUIAdaptersRegistered,
} from "../registerDramahaUIAdapter.js";

describe("DramahaUIAdapter", () => {
  it("labels draw and final streets for the UI", () => {
    const adapter = new DramahaUIAdapter();

    expect(adapter.formatStreetLabel("DRAW")).toBe("Draw");
    expect(adapter.formatStreetLabel("FINAL")).toBe("Final Bet");
  });

  it("registers all Dramaha app variants", () => {
    clearGameUIAdapters();
    ensureDramahaUIAdaptersRegistered();

    expect(getGameUIAdapter("dramaha_hi")).toBeInstanceOf(DramahaUIAdapter);
    expect(getGameUIAdapter("dramaha_27")).toBeInstanceOf(DramahaUIAdapter);
    expect(getGameUIAdapter("dramaha_a5")).toBeInstanceOf(DramahaUIAdapter);
    expect(getGameUIAdapter("dramaha_zero")).toBeInstanceOf(DramahaUIAdapter);
    expect(getGameUIAdapter("dramaha_hidugi")).toBeInstanceOf(DramahaUIAdapter);
    expect(getGameUIAdapter("dramaha_badugi")).toBeInstanceOf(DramahaUIAdapter);
  });
});
