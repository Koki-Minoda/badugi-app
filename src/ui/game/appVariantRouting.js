export const APP_VARIANT_IDS = {
  BADUGI: "badugi",
  NLH: "nlh",
  FLH: "flh",
  PLO: "plo",
  PLO8: "plo8",
  FLO8: "flo8",
  BIG_O: "big_o",
  FIVE_CARD_PLO: "five_card_plo",
  STUD: "stud",
  STUD8: "stud8",
  RAZZ: "razz",
  RAZZ27: "razz27",
  RAZZDUGI: "razzdugi",
  RAZZDUCEY: "razzducey",
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
  ["b01", APP_VARIANT_IDS.NLH],
  ["flh", APP_VARIANT_IDS.FLH],
  ["limit_holdem", APP_VARIANT_IDS.FLH],
  ["fixed_limit_holdem", APP_VARIANT_IDS.FLH],
  ["limit-holdem", APP_VARIANT_IDS.FLH],
  ["b02", APP_VARIANT_IDS.FLH],
  ["plo", APP_VARIANT_IDS.PLO],
  ["pot_limit_omaha", APP_VARIANT_IDS.PLO],
  ["pot-limit-omaha", APP_VARIANT_IDS.PLO],
  ["omaha", APP_VARIANT_IDS.PLO],
  ["b05", APP_VARIANT_IDS.PLO],
  ["plo8", APP_VARIANT_IDS.PLO8],
  ["plo-8", APP_VARIANT_IDS.PLO8],
  ["omaha8", APP_VARIANT_IDS.PLO8],
  ["omaha_8", APP_VARIANT_IDS.PLO8],
  ["b06", APP_VARIANT_IDS.PLO8],
  ["flo8", APP_VARIANT_IDS.FLO8],
  ["fl_omaha_8", APP_VARIANT_IDS.FLO8],
  ["fixed_limit_omaha_8", APP_VARIANT_IDS.FLO8],
  ["b09", APP_VARIANT_IDS.FLO8],
  ["big_o", APP_VARIANT_IDS.BIG_O],
  ["big-o", APP_VARIANT_IDS.BIG_O],
  ["bigo", APP_VARIANT_IDS.BIG_O],
  ["five_card_plo", APP_VARIANT_IDS.FIVE_CARD_PLO],
  ["five-card-plo", APP_VARIANT_IDS.FIVE_CARD_PLO],
  ["5_card_plo", APP_VARIANT_IDS.FIVE_CARD_PLO],
  ["5-card-plo", APP_VARIANT_IDS.FIVE_CARD_PLO],
  ["b08", APP_VARIANT_IDS.FIVE_CARD_PLO],
  ["stud", APP_VARIANT_IDS.STUD],
  ["seven_card_stud", APP_VARIANT_IDS.STUD],
  ["st1", APP_VARIANT_IDS.STUD],
  ["stud8", APP_VARIANT_IDS.STUD8],
  ["stud_8", APP_VARIANT_IDS.STUD8],
  ["seven_card_stud_8", APP_VARIANT_IDS.STUD8],
  ["st2", APP_VARIANT_IDS.STUD8],
  ["razz", APP_VARIANT_IDS.RAZZ],
  ["st3", APP_VARIANT_IDS.RAZZ],
  ["razz27", APP_VARIANT_IDS.RAZZ27],
  ["2_7_razz", APP_VARIANT_IDS.RAZZ27],
  ["2-7-razz", APP_VARIANT_IDS.RAZZ27],
  ["st6", APP_VARIANT_IDS.RAZZ27],
  ["razzdugi", APP_VARIANT_IDS.RAZZDUGI],
  ["st4", APP_VARIANT_IDS.RAZZDUGI],
  ["razzducey", APP_VARIANT_IDS.RAZZDUCEY],
  ["st5", APP_VARIANT_IDS.RAZZDUCEY],
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

export const BOARD_APP_VARIANT_IDS = new Set([
  APP_VARIANT_IDS.NLH,
  APP_VARIANT_IDS.FLH,
  APP_VARIANT_IDS.PLO,
  APP_VARIANT_IDS.PLO8,
  APP_VARIANT_IDS.FLO8,
  APP_VARIANT_IDS.BIG_O,
  APP_VARIANT_IDS.FIVE_CARD_PLO,
]);

export const STUD_APP_VARIANT_IDS = new Set([
  APP_VARIANT_IDS.STUD,
  APP_VARIANT_IDS.STUD8,
  APP_VARIANT_IDS.RAZZ,
  APP_VARIANT_IDS.RAZZ27,
  APP_VARIANT_IDS.RAZZDUGI,
  APP_VARIANT_IDS.RAZZDUCEY,
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
    BOARD_APP_VARIANT_IDS.has(normalized) ||
    STUD_APP_VARIANT_IDS.has(normalized) ||
    DRAMAHA_APP_VARIANT_IDS.has(normalized) ||
    DRAW_LOWBALL_APP_VARIANTS.has(normalized)
  );
}
