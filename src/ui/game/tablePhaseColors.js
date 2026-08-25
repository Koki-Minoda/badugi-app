export function getTablePhaseColors(phase = "BET") {
  const normalized = String(phase ?? "").toUpperCase();
  const isDraw = normalized === "DRAW" || normalized === "DRAWING";
  return {
    tableOuterBg: "bg-green-800",
    tableSurfaceBg: "bg-green-700",
    tableBorderColor: isDraw ? "border-red-400" : "border-yellow-600",
    tableAccentRing: isDraw
      ? "ring-2 ring-red-400/70 shadow-[0_0_24px_rgba(248,113,113,0.42)]"
      : "ring-0",
    phaseTone: isDraw ? "draw" : normalized === "SHOWDOWN" ? "showdown" : "bet",
  };
}

export default getTablePhaseColors;
