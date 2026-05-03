const CPU_CHARACTER_ROSTER = Object.freeze([
  { id: "akira", name: "Akira", style: "balanced" },
  { id: "mina", name: "Mina", style: "tight-aggressive" },
  { id: "ren", name: "Ren", style: "opponent-reader" },
  { id: "sora", name: "Sora", style: "loose-aggressive" },
  { id: "hana", name: "Hana", style: "patient-value" },
  { id: "jun", name: "Jun", style: "semi-bluff" },
  { id: "rei", name: "Rei", style: "draw-pressure" },
  { id: "yuki", name: "Yuki", style: "pot-control" },
  { id: "nagi", name: "Nagi", style: "exploit-reader" },
  { id: "kei", name: "Kei", style: "final-table" },
  { id: "rio", name: "Rio", style: "short-stack" },
  { id: "toma", name: "Toma", style: "isolation" },
  { id: "emi", name: "Emi", style: "passive-punisher" },
  { id: "kai", name: "Kai", style: "range-discipline" },
  { id: "mio", name: "Mio", style: "late-position" },
  { id: "ryo", name: "Ryo", style: "pat-pressure" },
  { id: "aoi", name: "Aoi", style: "thin-value" },
  { id: "zen", name: "Zen", style: "worldmaster-probe" },
]);

export function getCpuRoster() {
  return CPU_CHARACTER_ROSTER;
}

export function getCpuCharacterForIndex(index = 0) {
  const numericIndex = Number.isFinite(Number(index)) ? Math.trunc(Number(index)) : 0;
  const rosterIndex =
    ((numericIndex % CPU_CHARACTER_ROSTER.length) + CPU_CHARACTER_ROSTER.length) %
    CPU_CHARACTER_ROSTER.length;
  return CPU_CHARACTER_ROSTER[rosterIndex];
}

export function getCpuDisplayName(index = 0) {
  return getCpuCharacterForIndex(index).name;
}
