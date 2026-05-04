export const GAME_VARIANTS = [
  { id: "badugi", label: "Badugi", enabled: true },
  { id: "nlh", label: "No-Limit Hold'em", enabled: true },
  { id: "D01", label: "2-7 Triple Draw", enabled: true },
  { id: "D02", label: "A-5 Triple Draw", enabled: true },
  { id: "S01", label: "2-7 Single Draw", enabled: true },
  { id: "S02", label: "A-5 Single Draw", enabled: true },
  { id: "plo", label: "Pot-Limit Omaha", enabled: true },
];

export function getEnabledVariants() {
  return GAME_VARIANTS.filter((variant) => variant.enabled);
}
