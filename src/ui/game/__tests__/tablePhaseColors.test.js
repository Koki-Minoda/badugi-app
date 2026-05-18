import { describe, expect, it } from "vitest";
import { getTablePhaseColors } from "../tablePhaseColors.js";

describe("table phase colors", () => {
  it("keeps the felt green during draw rounds", () => {
    expect(getTablePhaseColors("DRAW")).toMatchObject({
      tableOuterBg: "bg-green-800",
      tableSurfaceBg: "bg-green-700",
      tableBorderColor: "border-cyan-300",
    });
  });

  it("keeps betting rounds on the standard green felt", () => {
    expect(getTablePhaseColors("BET")).toMatchObject({
      tableOuterBg: "bg-green-800",
      tableSurfaceBg: "bg-green-700",
      tableBorderColor: "border-yellow-600",
    });
  });
});
