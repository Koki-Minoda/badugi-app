import { describe, expect, it } from "vitest";
import { buildBetSizingModel } from "../betSizing.js";

describe("buildBetSizingModel", () => {
  it("builds legal no-limit bet presets before betting opens", () => {
    expect(buildBetSizingModel({
      structure: "no-limit",
      currentBet: 0,
      heroStack: 200,
      pot: 30,
      bigBlind: 10,
    })).toMatchObject({
      enabled: true,
      actionType: "bet",
      minCommit: 10,
      maxCommit: 200,
      presets: [
        { key: "min", amount: 10 },
        { key: "half-pot", amount: 15 },
        { key: "pot", amount: 30 },
        { key: "all-in", amount: 200 },
      ],
    });
  });

  it("includes the call when calculating a no-limit raise contribution", () => {
    const model = buildBetSizingModel({
      structure: "no-limit",
      currentBet: 40,
      heroBet: 10,
      heroStack: 300,
      pot: 90,
      bigBlind: 10,
      lastFullRaiseSize: 20,
    });
    expect(model).toMatchObject({
      actionType: "raise",
      toCall: 30,
      minCommit: 50,
      maxCommit: 300,
    });
    expect(model.presets.find((preset) => preset.key === "pot")?.amount).toBe(150);
  });

  it("caps a pot-limit raise at pot plus twice the call", () => {
    const model = buildBetSizingModel({
      structure: "pot-limit",
      currentBet: 40,
      heroBet: 10,
      heroStack: 500,
      pot: 90,
      bigBlind: 10,
      lastFullRaiseSize: 20,
    });
    expect(model.maxCommit).toBe(150);
    expect(model.presets.some((preset) => preset.key === "all-in")).toBe(false);
  });

  it("allows only a short all-in when stack cannot make a full raise", () => {
    const model = buildBetSizingModel({
      structure: "no-limit",
      currentBet: 40,
      heroBet: 10,
      heroStack: 35,
      pot: 90,
      bigBlind: 10,
      lastFullRaiseSize: 20,
    });
    expect(model).toMatchObject({ minCommit: 35, maxCommit: 35 });
    expect(model.presets).toEqual([{ key: "min", label: "Min", amount: 35 }]);
  });

  it("stays disabled for fixed-limit games", () => {
    expect(buildBetSizingModel({ structure: "fixed-limit" })).toEqual({ enabled: false });
  });
});
