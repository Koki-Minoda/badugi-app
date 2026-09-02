export const VARIANT_AVAILABILITY_STATES = Object.freeze({
  ALPHA_PLAYABLE: "alpha_playable",
  PREVIEW_ONLY: "preview_only",
  COMING_SOON: "coming_soon",
  HIDDEN: "hidden",
});

export const PREVIEW_VARIANTS_STORAGE_KEY = "mgx.previewVariants";
export const ALPHA_ONLY_VARIANTS_STORAGE_KEY = "mgx.alphaOnlyVariants";

// Product-owned source of truth for variants that are available without a
// preview flag. Release and production-QM tooling must derive their coverage
// from this list so a newly published game cannot silently miss its gates.
export const PUBLIC_PLAYABLE_VARIANTS = Object.freeze([
  Object.freeze({
    id: "badugi",
    availabilityKey: "badugi",
    displayName: "Badugi",
    cashQm: Object.freeze({ expectsDraw: true, expectsBlindIncrease: true }),
  }),
  Object.freeze({
    id: "nlh",
    availabilityKey: "nlh",
    displayName: "NL Hold'em",
    cashQm: Object.freeze({ expectsDraw: false, expectsBlindIncrease: false }),
  }),
  ...[
    ["plo", "Pot-Limit Omaha"],
    ["plo8", "PLO8"],
    ["flo8", "FLO8"],
    ["big_o", "Big-O"],
    ["five_card_plo", "5-Card PLO"],
  ].map(([id, displayName]) =>
    Object.freeze({
      id,
      availabilityKey: id,
      displayName,
      cashQm: Object.freeze({ expectsDraw: false, expectsBlindIncrease: false }),
    }),
  ),
  Object.freeze({
    id: "D01",
    availabilityKey: "deuce_to_seven_triple_draw",
    displayName: "2-7 Triple Draw",
    cashQm: Object.freeze({ expectsDraw: true, expectsBlindIncrease: true }),
  }),
  Object.freeze({
    id: "D02",
    availabilityKey: "ace_to_five_triple_draw",
    displayName: "A-5 Triple Draw",
    cashQm: Object.freeze({ expectsDraw: true, expectsBlindIncrease: true }),
  }),
  Object.freeze({
    id: "S01",
    availabilityKey: "deuce_to_seven_single_draw",
    displayName: "2-7 Single Draw",
    cashQm: Object.freeze({ expectsDraw: true, expectsBlindIncrease: true }),
  }),
  Object.freeze({
    id: "S02",
    availabilityKey: "ace_to_five_single_draw",
    displayName: "A-5 Single Draw",
    cashQm: Object.freeze({ expectsDraw: true, expectsBlindIncrease: true }),
  }),
  Object.freeze({
    id: "stud",
    availabilityKey: "stud",
    displayName: "Seven Card Stud",
    cashQm: Object.freeze({ expectsDraw: false, expectsBlindIncrease: false }),
  }),
  Object.freeze({
    id: "stud8",
    availabilityKey: "stud8",
    displayName: "Seven Card Stud Hi/Lo",
    cashQm: Object.freeze({ expectsDraw: false, expectsBlindIncrease: false }),
  }),
  Object.freeze({
    id: "razz",
    availabilityKey: "razz",
    displayName: "Razz",
    cashQm: Object.freeze({ expectsDraw: false, expectsBlindIncrease: false }),
  }),
  Object.freeze({
    id: "razzdugi",
    availabilityKey: "razzdugi",
    displayName: "Razzdugi",
    cashQm: Object.freeze({ expectsDraw: false, expectsBlindIncrease: false }),
  }),
  Object.freeze({
    id: "razzducey",
    availabilityKey: "razzducey",
    displayName: "Razzducey",
    cashQm: Object.freeze({ expectsDraw: false, expectsBlindIncrease: false }),
  }),
  Object.freeze({
    id: "razz27",
    availabilityKey: "razz27",
    displayName: "2-7 Razz",
    cashQm: Object.freeze({ expectsDraw: false, expectsBlindIncrease: false }),
  }),
  ...[
    ["dramaha_hi", "Dramaha Hi"],
    ["dramaha_27", "Dramaha 2-7"],
    ["dramaha_a5", "Dramaha A-5"],
    ["dramaha_zero", "Dramaha Zero"],
    ["dramaha_hidugi", "Dramaha Hidugi"],
    ["dramaha_badugi", "Dramaha Badugi"],
  ].map(([id, displayName]) =>
    Object.freeze({
      id,
      availabilityKey: id,
      displayName,
      cashQm: Object.freeze({ expectsDraw: true, expectsBlindIncrease: false }),
    }),
  ),
]);

const ALPHA_REASON =
  "Core draw-game flow is enabled for friend alpha.";
const BADUGI_ALPHA_REASON =
  "Core MGX alpha game; automated progression, pot, terminal, orientation gates passed.";
const STUD_ALPHA_REASON =
  "Bring-in, third-through-seventh street, all-in/side-pot settlement, exact replay, and three-device long-run gates passed.";
const DRAMAHA_ALPHA_REASON =
  "Five-card board/draw flow, split and odd-chip settlement, exact replay, and desktop/Android/WebKit ten-hand gates passed.";
const OMAHA_ALPHA_REASON =
  "Must-use-two evaluation, all-in/side-pot and Hi/Lo settlement, odd-chip ordering, exact replay, cash-out, and desktop/Android/WebKit ten-hand gates passed.";
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
  badugi: makeEntry({
    availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE,
    label: "Badugi",
    statusLabel: "Alpha",
    statusLabelJa: "Alpha",
    reason: BADUGI_ALPHA_REASON,
    requiredBeforeAlpha: [],
  }),
  nlh: makeEntry({
    availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE,
    label: "No-Limit Hold'em",
    statusLabel: "Alpha",
    statusLabelJa: "Alpha",
    reason:
      "Cash, store/local tournament, exact replay, cash-out, Android, and iPhone/WebKit release gates passed.",
    requiredBeforeAlpha: [],
  }),
  flh: preview("Fixed-Limit Hold'em"),
  super_holdem: preview("NL Super Hold'em"),
  fl_super_holdem: preview("FL Super Hold'em"),
  plo: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Pot-Limit Omaha", statusLabel: "Alpha", reason: OMAHA_ALPHA_REASON }),
  plo8: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "PLO8", statusLabel: "Alpha", reason: OMAHA_ALPHA_REASON }),
  flo8: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "FLO8", statusLabel: "Alpha", reason: OMAHA_ALPHA_REASON }),
  big_o: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Big-O", statusLabel: "Alpha", reason: OMAHA_ALPHA_REASON }),
  five_card_plo: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "5-Card PLO", statusLabel: "Alpha", reason: OMAHA_ALPHA_REASON }),
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
  dramaha_hi: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Dramaha Hi", statusLabel: "Alpha", reason: DRAMAHA_ALPHA_REASON }),
  dramaha_27: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Dramaha 2-7", statusLabel: "Alpha", reason: DRAMAHA_ALPHA_REASON }),
  dramaha_a5: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Dramaha A-5", statusLabel: "Alpha", reason: DRAMAHA_ALPHA_REASON }),
  dramaha_zero: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Dramaha Zero", statusLabel: "Alpha", reason: DRAMAHA_ALPHA_REASON }),
  dramaha_hidugi: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Dramaha Hidugi", statusLabel: "Alpha", reason: DRAMAHA_ALPHA_REASON }),
  dramaha_badugi: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Dramaha Badugi", statusLabel: "Alpha", reason: DRAMAHA_ALPHA_REASON }),
  stud: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Stud", statusLabel: "Alpha", reason: STUD_ALPHA_REASON }),
  stud8: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Stud 8", statusLabel: "Alpha", reason: STUD_ALPHA_REASON }),
  razz: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Razz", statusLabel: "Alpha", reason: STUD_ALPHA_REASON }),
  razzdugi: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Razzdugi", statusLabel: "Alpha", reason: STUD_ALPHA_REASON }),
  razzducey: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "Razzducey", statusLabel: "Alpha", reason: STUD_ALPHA_REASON }),
  razz27: makeEntry({ availability: VARIANT_AVAILABILITY_STATES.ALPHA_PLAYABLE, label: "2-7 Razz", statusLabel: "Alpha", reason: STUD_ALPHA_REASON }),
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
