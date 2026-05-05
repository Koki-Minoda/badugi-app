const PUBLIC_BASE_URL = (import.meta?.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
const publicAsset = (path) => `${PUBLIC_BASE_URL}${String(path).replace(/^\//, "")}`;

const CPU_CHARACTER_ROSTER = Object.freeze([
  { id: "akira", name: "Akira", style: "balanced", avatarUrl: publicAsset("characters/akira.png") },
  { id: "mina", name: "Mina", style: "tight-aggressive", avatarUrl: publicAsset("characters/mina.png") },
  { id: "ren", name: "Ren", style: "opponent-reader", avatarUrl: publicAsset("characters/ren.png") },
  { id: "sora", name: "Sora", style: "loose-aggressive", avatarUrl: publicAsset("characters/sora.png") },
  { id: "hana", name: "Hana", style: "patient-value", avatarUrl: publicAsset("characters/hana.png") },
  { id: "jun", name: "Jun", style: "semi-bluff", avatarUrl: publicAsset("characters/jun.png") },
  { id: "rei", name: "Rei", style: "draw-pressure", avatarUrl: publicAsset("characters/rei.png") },
  { id: "yuki", name: "Yuki", style: "pot-control", avatarUrl: publicAsset("characters/yuki.png") },
  { id: "nagi", name: "Nagi", style: "exploit-reader", avatarUrl: publicAsset("characters/nagi.png") },
  { id: "kei", name: "Kei", style: "final-table", avatarUrl: publicAsset("characters/kei.png") },
  { id: "rio", name: "Rio", style: "short-stack", avatarUrl: publicAsset("characters/rio.png") },
  { id: "toma", name: "Toma", style: "isolation", avatarUrl: publicAsset("characters/toma.png") },
  { id: "emi", name: "Emi", style: "passive-punisher", avatarUrl: publicAsset("characters/emi.png") },
  { id: "kai", name: "Kai", style: "range-discipline", avatarUrl: publicAsset("characters/kai.png") },
  { id: "mio", name: "Mio", style: "late-position", avatarUrl: publicAsset("characters/mio.png") },
  { id: "ryo", name: "Ryo", style: "pat-pressure", avatarUrl: publicAsset("characters/ryo.png") },
  { id: "aoi", name: "Aoi", style: "thin-value", avatarUrl: publicAsset("characters/aoi.png") },
  { id: "zen", name: "Zen", style: "worldmaster-probe", avatarUrl: publicAsset("characters/zen.png") },
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

export function getCpuCharacterByName(name = "") {
  const normalizedName = String(name ?? "").trim().toLowerCase();
  if (!normalizedName) return null;
  return (
    CPU_CHARACTER_ROSTER.find(
      (character) => character.name.toLowerCase() === normalizedName,
    ) ?? null
  );
}

export function getCpuDisplayName(index = 0) {
  return getCpuCharacterForIndex(index).name;
}
