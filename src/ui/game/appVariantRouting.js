export const APP_VARIANT_IDS = {
  BADUGI: "badugi",
  NLH: "nlh",
  PLO: "plo",
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
    DRAW_LOWBALL_APP_VARIANTS.has(normalized)
  );
}
