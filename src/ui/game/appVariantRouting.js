export const APP_VARIANT_IDS = {
  BADUGI: "badugi",
  NLH: "nlh",
  PLO: "plo",
  BIG_O: "big_o",
  FIVE_CARD_PLO: "five_card_plo",
  DRAMAHA_HI: "dramaha_hi",
  DRAMAHA_27: "dramaha_27",
  DRAMAHA_A5: "dramaha_a5",
  DRAMAHA_ZERO: "dramaha_zero",
  DRAMAHA_HIDUGI: "dramaha_hidugi",
  DRAMAHA_BADUGI: "dramaha_badugi",
  D01: "deuce_to_seven_triple_draw",
  D02: "ace_to_five_triple_draw",
  S01: "deuce_to_seven_single_draw",
  S02: "ace_to_five_single_draw",
};

const VARIANT_ALIASES = new Map([
  ["badugi", APP_VARIANT_IDS.BADUGI],
  ["d03", APP_VARIANT_IDS.BADUGI],
  ["nlh", APP_VARIANT_IDS.NLH],
  ["nl_holdem", APP_VARIANT_IDS.NLH],
  ["holdem", APP_VARIANT_IDS.NLH],
  ["plo", APP_VARIANT_IDS.PLO],
  ["pot_limit_omaha", APP_VARIANT_IDS.PLO],
  ["pot-limit-omaha", APP_VARIANT_IDS.PLO],
  ["omaha", APP_VARIANT_IDS.PLO],
  ["big_o", APP_VARIANT_IDS.BIG_O],
  ["big-o", APP_VARIANT_IDS.BIG_O],
  ["bigo", APP_VARIANT_IDS.BIG_O],
  ["five_card_plo", APP_VARIANT_IDS.FIVE_CARD_PLO],
  ["five-card-plo", APP_VARIANT_IDS.FIVE_CARD_PLO],
  ["5_card_plo", APP_VARIANT_IDS.FIVE_CARD_PLO],
  ["5-card-plo", APP_VARIANT_IDS.FIVE_CARD_PLO],
  ["dramaha_hi", APP_VARIANT_IDS.DRAMAHA_HI],
  ["dramaha-hi", APP_VARIANT_IDS.DRAMAHA_HI],
  ["dramaha", APP_VARIANT_IDS.DRAMAHA_HI],
  ["dramaha_27", APP_VARIANT_IDS.DRAMAHA_27],
  ["dramaha-27", APP_VARIANT_IDS.DRAMAHA_27],
  ["dramaha_2_7", APP_VARIANT_IDS.DRAMAHA_27],
  ["dramaha_a5", APP_VARIANT_IDS.DRAMAHA_A5],
  ["dramaha-a5", APP_VARIANT_IDS.DRAMAHA_A5],
  ["dramaha_zero", APP_VARIANT_IDS.DRAMAHA_ZERO],
  ["dramaha-zero", APP_VARIANT_IDS.DRAMAHA_ZERO],
  ["dramaha_hidugi", APP_VARIANT_IDS.DRAMAHA_HIDUGI],
  ["dramaha-hidugi", APP_VARIANT_IDS.DRAMAHA_HIDUGI],
  ["dramaha_badugi", APP_VARIANT_IDS.DRAMAHA_BADUGI],
  ["dramaha-badugi", APP_VARIANT_IDS.DRAMAHA_BADUGI],
  ["d01", APP_VARIANT_IDS.D01],
  ["27td", APP_VARIANT_IDS.D01],
  ["2-7-triple-draw", APP_VARIANT_IDS.D01],
  ["deuce_to_seven_triple_draw", APP_VARIANT_IDS.D01],
  ["d02", APP_VARIANT_IDS.D02],
  ["a5td", APP_VARIANT_IDS.D02],
  ["a-5-triple-draw", APP_VARIANT_IDS.D02],
  ["ace_to_five_triple_draw", APP_VARIANT_IDS.D02],
  ["s01", APP_VARIANT_IDS.S01],
  ["27sd", APP_VARIANT_IDS.S01],
  ["2-7-single-draw", APP_VARIANT_IDS.S01],
  ["deuce_to_seven_single_draw", APP_VARIANT_IDS.S01],
  ["s02", APP_VARIANT_IDS.S02],
  ["a5sd", APP_VARIANT_IDS.S02],
  ["a-5-single-draw", APP_VARIANT_IDS.S02],
  ["ace_to_five_single_draw", APP_VARIANT_IDS.S02],
]);

export const DRAW_LOWBALL_APP_VARIANTS = new Set([
  APP_VARIANT_IDS.D01,
  APP_VARIANT_IDS.D02,
  APP_VARIANT_IDS.S01,
  APP_VARIANT_IDS.S02,
]);

export const DRAMAHA_APP_VARIANT_IDS = new Set([
  APP_VARIANT_IDS.DRAMAHA_HI,
  APP_VARIANT_IDS.DRAMAHA_27,
  APP_VARIANT_IDS.DRAMAHA_A5,
  APP_VARIANT_IDS.DRAMAHA_ZERO,
  APP_VARIANT_IDS.DRAMAHA_HIDUGI,
  APP_VARIANT_IDS.DRAMAHA_BADUGI,
]);

export function normalizeAppVariantId(variantId, fallback = APP_VARIANT_IDS.BADUGI) {
  if (!variantId) return fallback;
  const key = String(variantId).trim().toLowerCase();
  return VARIANT_ALIASES.get(key) ?? fallback;
}

export function isDrawLowballAppVariant(variantId) {
  return DRAW_LOWBALL_APP_VARIANTS.has(normalizeAppVariantId(variantId, null));
}

export function isControllerBackedAppVariant(variantId) {
  const normalized = normalizeAppVariantId(variantId, null);
  return (
    normalized === APP_VARIANT_IDS.BADUGI ||
    normalized === APP_VARIANT_IDS.NLH ||
    normalized === APP_VARIANT_IDS.PLO ||
    normalized === APP_VARIANT_IDS.BIG_O ||
    normalized === APP_VARIANT_IDS.FIVE_CARD_PLO ||
    DRAMAHA_APP_VARIANT_IDS.has(normalized) ||
    DRAW_LOWBALL_APP_VARIANTS.has(normalized)
  );
}
