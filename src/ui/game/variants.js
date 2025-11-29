export const GAME_VARIANTS = [
  { id: "badugi", label: "Badugi", enabled: true },
  { id: "nlh", label: "No-Limit Hold'em", enabled: true },
  { id: "plo", label: "Pot-Limit Omaha", enabled: false },
  { id: "27sd", label: "2-7 Single Draw", enabled: false },
];

export function getEnabledVariants() {
  return GAME_VARIANTS.filter((variant) => variant.enabled);
}
