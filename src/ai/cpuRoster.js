const CPU_CHARACTER_ROSTER = Object.freeze([
  { id: "akira", name: "Akira", style: "balanced", avatarUrl: "/characters/akira.png" },
  { id: "mina", name: "Mina", style: "tight-aggressive", avatarUrl: "/characters/mina.png" },
  { id: "ren", name: "Ren", style: "opponent-reader", avatarUrl: "/characters/ren.png" },
  { id: "sora", name: "Sora", style: "loose-aggressive", avatarUrl: "/characters/sora.png" },
  { id: "hana", name: "Hana", style: "patient-value", avatarUrl: "/characters/hana.png" },
  { id: "jun", name: "Jun", style: "semi-bluff", avatarUrl: "/characters/jun.png" },
  { id: "rei", name: "Rei", style: "draw-pressure", avatarUrl: "/characters/rei.png" },
  { id: "yuki", name: "Yuki", style: "pot-control", avatarUrl: "/characters/yuki.png" },
  { id: "nagi", name: "Nagi", style: "exploit-reader", avatarUrl: "/characters/nagi.png" },
  { id: "kei", name: "Kei", style: "final-table", avatarUrl: "/characters/kei.png" },
  { id: "rio", name: "Rio", style: "short-stack", avatarUrl: "/characters/rio.png" },
  { id: "toma", name: "Toma", style: "isolation", avatarUrl: "/characters/toma.png" },
  { id: "emi", name: "Emi", style: "passive-punisher", avatarUrl: "/characters/emi.png" },
  { id: "kai", name: "Kai", style: "range-discipline", avatarUrl: "/characters/kai.png" },
  { id: "mio", name: "Mio", style: "late-position", avatarUrl: "/characters/mio.png" },
  { id: "ryo", name: "Ryo", style: "pat-pressure", avatarUrl: "/characters/ryo.png" },
  { id: "aoi", name: "Aoi", style: "thin-value", avatarUrl: "/characters/aoi.png" },
  { id: "zen", name: "Zen", style: "worldmaster-probe", avatarUrl: "/characters/zen.png" },
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
