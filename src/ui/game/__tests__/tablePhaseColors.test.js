import { describe, expect, it } from "vitest";
import { getTablePhaseColors } from "../tablePhaseColors.js";

describe("table phase colors", () => {
  it.each(["DRAW", "draw", "DRAWING"])(
    "uses a red accent during %s rounds while keeping the felt green",
    (phase) => {
      expect(getTablePhaseColors(phase)).toMatchObject({
        tableOuterBg: "bg-green-800",
        tableSurfaceBg: "bg-green-700",
        tableBorderColor: "border-red-400",
        phaseTone: "draw",
      });
      expect(getTablePhaseColors(phase).tableAccentRing).toContain("red");
    },
  );

  it.each(["BET", "SHOWDOWN", "WAITING"])("does not leak the draw accent into %s", (phase) => {
    const colors = getTablePhaseColors(phase);
    expect(colors.tableBorderColor).not.toContain("red");
    expect(colors.tableAccentRing).not.toContain("red");
    expect(colors.phaseTone).not.toBe("draw");
  });

  it("keeps betting rounds on the standard green felt", () => {
    expect(getTablePhaseColors("BET")).toMatchObject({
      tableOuterBg: "bg-green-800",
      tableSurfaceBg: "bg-green-700",
      tableBorderColor: "border-yellow-600",
      phaseTone: "bet",
    });
  });
});
