export const VARIANT_AVAILABILITY_STATES = Object.freeze({
  ALPHA_PLAYABLE: "alpha_playable",
  PREVIEW_ONLY: "preview_only",
  COMING_SOON: "coming_soon",
  HIDDEN: "hidden",
});

export const PREVIEW_VARIANTS_STORAGE_KEY = "mgx.previewVariants";
export const ALPHA_ONLY_VARIANTS_STORAGE_KEY = "mgx.alphaOnlyVariants";

const ALPHA_REASON =
  "Core draw-game flow is enabled for friend alpha while Badugi blockers are isolated.";
const PREVIEW_REASON =
  "Playable for development review, but long-run natural UI, mobile, replay, or split-result coverage is not alpha-ready.";

const makeEntry = ({
  availability,
  label,
  statusLabel,
  statusLabelJa,
  reason,
  blockers = [],
  requiredBeforeAlpha = [],
  requiredFlag = null,
}) =>
  Object.freeze({
    availability,
    alphaPlayable: availability === VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE,
    label,
    statusLabel,
    statusLabelJa: statusLabelJa ?? statusLabel,
    reason,
    blockers: Object.freeze([...blockers]),
    requiredBeforeAlpha: Object.freeze([...requiredBeforeAlpha]),
    requiredFlag,
    previewOnly: true,
  });

const alpha = (label) =>
  makeEntry({
    availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE,
    label,
    statusLabel: "Alpha",
    statusLabelJa: "Alpha",
    reason: ALPHA_REASON,
  });

const preview = (label, reason = PREVIEW_REASON, blockers = []) =>
  makeEntry({
    availability: VARIANT_AVAILABILITY_STATES.PREVIEW_ONLY,
    label,
    statusLabel: "Preview",
    statusLabelJa: "検証中",
    reason,
    blockers,
    requiredBeforeAlpha: blockers.length
      ? blockers
      : ["Natural long-run UI smoke", "mobile QA", "replay/result QA"],
    requiredFlag: "VITE_MGX_SHOW_PREVIEW_VARIANTS or mgx.previewVariants=true",
  });

const comingSoon = (label, reason, blockers = []) =>
  makeEntry({
    availability: VARIANT_AVAILABILITY_STATES.COMING_SOON,
    label,
    statusLabel: "Coming Soon",
    statusLabelJa: "準備中",
    reason,
    blockers,
    requiredBeforeAlpha: blockers,
  });

export const VARIANT_AVAILABILITY = Object.freeze({
  badugi: preview("Badugi", "Automated restore gates pass, but physical mobile full-hand QA is still pending.", [
    "BG-005",
  ]),
  nlh: preview("No-Limit Hold'em"),
  flh: preview("Fixed-Limit Hold'em"),
  super_holdem: preview("NL Super Hold'em"),
  fl_super_holdem: preview("FL Super Hold'em"),
  plo: preview("Pot-Limit Omaha", "Board-game flow exists, but replay/mobile/EV gates are not alpha-ready.", [
    "EV-GUARD-06",
  ]),
  plo8: preview("PLO8", "Split-pot board-game flow exists, but split-result/mobile/EV gates are not alpha-ready.", [
    "EV-GUARD-06",
    "EV-GUARD-08",
  ]),
  flo8: preview("FLO8", "Fixed-limit split-pot flow exists, but split-result/mobile/EV gates are not alpha-ready.", [
    "EV-GUARD-06",
    "EV-GUARD-08",
  ]),
  big_o: preview("Big-O", "Five-card Omaha flow exists, but mobile/replay/EV gates are not alpha-ready.", [
    "EV-GUARD-06",
  ]),
  five_card_plo: preview("5-Card PLO", "Five-card Omaha flow exists, but mobile/replay/EV gates are not alpha-ready.", [
    "EV-GUARD-06",
  ]),
  deuce_to_seven_triple_draw: alpha("2-7 Triple Draw"),
  ace_to_five_triple_draw: alpha("A-5 Triple Draw"),
  badeucey_triple_draw: preview("Badeucey TD", "Split draw flow exists, but split-result/replay/mobile coverage is not alpha-ready."),
  badacey_triple_draw: preview("Badacey TD", "Split draw flow exists, but split-result/replay/mobile coverage is not alpha-ready."),
  hidugi_triple_draw: preview("Hidugi TD", "Special draw evaluator exists, but natural long-run/mobile/replay coverage is not alpha-ready."),
  archie_triple_draw: preview("Archie TD", "Special draw evaluator exists, but natural long-run/mobile/replay coverage is not alpha-ready."),
  deuce_to_seven_single_draw: alpha("2-7 Single Draw"),
  ace_to_five_single_draw: alpha("A-5 Single Draw"),
  five_card_single_draw: preview("5-Card Single Draw"),
  badugi_single_draw: preview("Badugi Single Draw", "Badugi-family UI and pot blockers must be cleared before friend alpha."),
  badeucey_single_draw: preview("Badeucey Single Draw", "Split draw flow exists, but split-result/replay/mobile coverage is not alpha-ready."),
  badacey_single_draw: preview("Badacey Single Draw", "Split draw flow exists, but split-result/replay/mobile coverage is not alpha-ready."),
  hidugi_single_draw: preview("Hidugi Single Draw", "Special draw evaluator exists, but natural long-run/mobile/replay coverage is not alpha-ready."),
  dramaha_hi: preview("Dramaha Hi", "Dramaha flow exists, but split result UX and replay/mobile QA are not alpha-ready."),
  dramaha_27: preview("Dramaha 2-7", "Dramaha flow exists, but split result UX and replay/mobile QA are not alpha-ready."),
  dramaha_a5: preview("Dramaha A-5", "Dramaha flow exists, but split result UX and replay/mobile QA are not alpha-ready."),
  dramaha_zero: preview("Dramaha Zero", "Dramaha flow exists, but split result UX and replay/mobile QA are not alpha-ready."),
  dramaha_hidugi: preview("Dramaha Hidugi", "Dramaha flow exists, but split result UX and replay/mobile QA are not alpha-ready."),
  dramaha_badugi: preview("Dramaha Badugi", "Dramaha/Badugi split flow exists, but Badugi blockers and split-result QA remain."),
  stud: preview("Stud", "Stud flow exists, but alpha mobile/replay/result QA is not complete."),
  stud8: preview("Stud 8", "Stud split flow exists, but split-result/mobile/replay QA is not alpha-ready."),
  razz: preview("Razz", "Razz flow exists, but alpha mobile/replay/result QA is not complete."),
  razzdugi: preview("Razzdugi", "Stud/Badugi hybrid flow is not friend-alpha ready."),
  razzducey: preview("Razzducey", "Stud/draw hybrid flow is not friend-alpha ready."),
  razz27: preview("2-7 Razz", "Razz variant flow exists, but alpha mobile/replay/result QA is not complete."),
  chinese_poker: comingSoon("Chinese Poker / OFC", "Chinese/OFC street progression and fantasyland are incomplete.", [
    "CHINESE-03",
  ]),
});

const VARIANT_ALIASES = Object.freeze({
  b01: "nlh",
  b02: "flh",
  b03: "super_holdem",
  b04: "fl_super_holdem",
  b05: "plo",
  b06: "plo8",
  b07: "big_o",
  b08: "five_card_plo",
  b09: "flo8",
  d01: "deuce_to_seven_triple_draw",
  d02: "ace_to_five_triple_draw",
  d03: "badugi",
  "2-7-triple-draw": "deuce_to_seven_triple_draw",
  "a-5-triple-draw": "ace_to_five_triple_draw",
  d04: "badeucey_triple_draw",
  d05: "badacey_triple_draw",
  d06: "hidugi_triple_draw",
  d07: "archie_triple_draw",
  s01: "deuce_to_seven_single_draw",
  s02: "ace_to_five_single_draw",
  s03: "five_card_single_draw",
  s04: "badugi_single_draw",
  s05: "badeucey_single_draw",
  s06: "badacey_single_draw",
  s07: "hidugi_single_draw",
  h01: "dramaha_hi",
  h02: "dramaha_27",
  h03: "dramaha_a5",
  h04: "dramaha_zero",
  h05: "dramaha_hidugi",
  h06: "dramaha_badugi",
  st1: "stud",
  st2: "stud8",
  st3: "razz",
  st4: "razzdugi",
  st5: "razzducey",
  st6: "razz27",
  cp1: "chinese_poker",
  ofc: "chinese_poker",
  chinese: "chinese_poker",
  "chinese-poker": "chinese_poker",
});

function normalizeBoolean(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function safeStorage(win = typeof window === "undefined" ? null : window) {
  if (!win?.localStorage) return null;
  try {
    const probe = "__mgx_variant_availability_probe__";
    win.localStorage.setItem(probe, "1");
    win.localStorage.removeItem(probe);
    return win.localStorage;
  } catch {
    return null;
  }
}

function storageFlag(storage, key) {
  if (!storage) return false;
  try {
    return normalizeBoolean(storage.getItem(key));
  } catch {
    return false;
  }
}

function queryFlag(search, key) {
  try {
    const params = new URLSearchParams(search ?? "");
    return normalizeBoolean(params.get(key));
  } catch {
    return false;
  }
}

function envFlag(env, key) {
  return normalizeBoolean(env?.[key]);
}

export function resolveVariantAvailabilityKey(variantId) {
  if (!variantId) return null;
  const raw = String(variantId).trim();
  if (!raw) return null;
  if (VARIANT_AVAILABILITY[raw]) return raw;
  const lower = raw.toLowerCase();
  return VARIANT_ALIASES[lower] ?? (VARIANT_AVAILABILITY[lower] ? lower : lower);
}

export function getVariantAvailability(variantId) {
  const key = resolveVariantAvailabilityKey(variantId);
  if (key && VARIANT_AVAILABILITY[key]) {
    return { key, ...VARIANT_AVAILABILITY[key] };
  }
  return {
    key,
    ...comingSoon(
      String(variantId ?? "Unknown Variant"),
      "Variant availability has not been audited for friend alpha.",
      ["availability audit missing"],
    ),
  };
}

export function resolveVariantGateFlags({
  env = typeof import.meta !== "undefined" ? import.meta.env : {},
  storage = safeStorage(),
  search = typeof window === "undefined" ? "" : window.location?.search ?? "",
  previewVariants,
  alphaOnlyVariants,
} = {}) {
  return {
    previewVariants:
      Boolean(previewVariants) ||
      envFlag(env, "VITE_MGX_SHOW_PREVIEW_VARIANTS") ||
      storageFlag(storage, PREVIEW_VARIANTS_STORAGE_KEY) ||
      queryFlag(search, "previewVariants"),
    alphaOnlyVariants:
      Boolean(alphaOnlyVariants) ||
      envFlag(env, "VITE_MGX_ALPHA_ONLY_VARIANTS") ||
      storageFlag(storage, ALPHA_ONLY_VARIANTS_STORAGE_KEY) ||
      queryFlag(search, "alphaOnlyVariants"),
  };
}

export function canLaunchVariant(variantId, options = {}) {
  const availability = getVariantAvailability(variantId);
  const flags = resolveVariantGateFlags(options);
  const state = availability.availability;
  const canLaunch =
    state === VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE ||
    (state === VARIANT_AVAILABILITY_STATES.PREVIEW_ONLY && flags.previewVariants);
  const hidden = state === VARIANT_AVAILABILITY_STATES.HIDDEN;
  return {
    ...availability,
    canLaunch: Boolean(canLaunch && !hidden),
    hidden,
    flags,
    reason: availability.reason,
  };
}

export function listVariantAvailability() {
  return Object.keys(VARIANT_AVAILABILITY)
    .sort()
    .map((key) => ({ key, ...VARIANT_AVAILABILITY[key] }));
}
