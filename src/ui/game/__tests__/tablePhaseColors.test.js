import { describe, expect, it } from "vitest";
import { getTablePhaseColors, resolveTablePresentationPhase } from "../tablePhaseColors.js";

describe("table presentation phase", () => {
  it("uses the active controller phase for the badge and color", () => {
    const phase = resolveTablePresentationPhase({
      controllerPhase: "DRAW",
      controlsPhase: "DRAW",
      legacyPhase: "BET",
    });
    expect(phase).toBe("DRAW");
    expect(getTablePhaseColors(phase).phaseTone).toBe("draw");
  });

  it("keeps result and bust overlays authoritative over a reset controller", () => {
    expect(resolveTablePresentationPhase({ controllerPhase: "BET", resultVisible: true }))
      .toBe("HAND_RESULT");
    expect(resolveTablePresentationPhase({ controllerPhase: "BET", tableFinished: true }))
      .toBe("TABLE_FINISHED");
  });
});

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
