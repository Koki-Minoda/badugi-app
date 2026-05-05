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

  it("exposes Dramaha draw street as a DRAW action phase", () => {
    const adapter = new DramahaUIAdapter();

    const props = adapter.buildViewProps({
      controllerSnapshot: {
        street: "DRAW",
        currentActor: 0,
        players: [
          { name: "Hero", stack: 100, holeCards: ["AS", "2D", "3C", "4H", "5S"] },
          { name: "CPU", stack: 100, holeCards: ["KS", "QD", "JC", "10H", "9S"] },
        ],
      },
      tableConfig: {},
    });

    expect(props.tablePhase).toBe("DRAW");
    expect(props.controlsConfig.phase).toBe("DRAW");
    expect(props.controlsConfig.isHeroTurn).toBe(true);
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
