export function getTablePhaseColors(phase = "BET") {
  const normalized = String(phase ?? "").toUpperCase();
  return {
    tableOuterBg: "bg-green-800",
    tableSurfaceBg: "bg-green-700",
    tableBorderColor: normalized === "DRAW" ? "border-cyan-300" : "border-yellow-600",
  };
}

export default getTablePhaseColors;
