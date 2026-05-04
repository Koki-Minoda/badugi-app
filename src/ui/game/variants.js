export const GAME_VARIANTS = [
  { id: "badugi", label: "Badugi", enabled: true },
  { id: "nlh", label: "No-Limit Hold'em", enabled: true },
  { id: "D01", label: "2-7 Triple Draw", enabled: true },
  { id: "D02", label: "A-5 Triple Draw", enabled: true },
  { id: "S01", label: "2-7 Single Draw", enabled: true },
  { id: "S02", label: "A-5 Single Draw", enabled: true },
  { id: "plo", label: "Pot-Limit Omaha", enabled: true },
  { id: "big_o", label: "Big-O", enabled: true },
  { id: "five_card_plo", label: "5-Card PLO", enabled: true },
  { id: "dramaha_hi", label: "Dramaha Hi", enabled: true },
  { id: "dramaha_27", label: "Dramaha 2-7", enabled: true },
  { id: "dramaha_a5", label: "Dramaha A-5", enabled: true },
  { id: "dramaha_zero", label: "Dramaha Zero", enabled: true },
  { id: "dramaha_hidugi", label: "Dramaha Hidugi", enabled: true },
  { id: "dramaha_badugi", label: "Dramaha Badugi", enabled: true },
];

export function getEnabledVariants() {
  return GAME_VARIANTS.filter((variant) => variant.enabled);
}
