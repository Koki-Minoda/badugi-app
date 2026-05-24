export const CORE5_SOAK_VARIANTS = [
  {
    id: "badugi",
    label: "Badugi",
    family: "badugi",
    expectedHeroCards: 4,
    maxSteps: 120,
  },
  {
    id: "D01",
    label: "2-7 Triple Draw",
    family: "draw-lowball-5card",
    expectedHeroCards: 5,
    maxSteps: 110,
  },
  {
    id: "D02",
    label: "A-5 Triple Draw",
    family: "draw-lowball-5card",
    expectedHeroCards: 5,
    maxSteps: 110,
  },
  {
    id: "S01",
    label: "2-7 Single Draw",
    family: "draw-lowball-5card",
    expectedHeroCards: 5,
    maxSteps: 90,
  },
  {
    id: "S02",
    label: "A-5 Single Draw",
    family: "draw-lowball-5card",
    expectedHeroCards: 5,
    maxSteps: 90,
  },
];

export const SOAK_MODES = ["cash", "tournament"];

export const SOAK_VIEWPORTS = [
  { id: "desktop-1280x720", width: 1280, height: 720, mobile: false },
  { id: "portrait-375x812", width: 375, height: 812, mobile: true },
  { id: "portrait-390x844", width: 390, height: 844, mobile: true },
  { id: "portrait-430x932", width: 430, height: 932, mobile: true },
];

export const SOAK_TIER_CONFIG = {
  fast: {
    seedCount: 10,
    handsPerScenario: 1,
    timeoutMs: 240000,
    traceMode: "compact",
  },
  standard: {
    seedCount: 30,
    handsPerScenario: 2,
    timeoutMs: 600000,
    traceMode: "compact",
  },
  exhaustive: {
    seedCount: 100,
    handsPerScenario: 3,
    timeoutMs: 1800000,
    traceMode: "normal",
  },
};

export const SOAK_BASE_SEEDS = [
  101, 127, 151, 179, 211, 251, 307, 353, 401, 463,
  521, 587, 647, 719, 797, 877, 967, 1051, 1151, 1237,
  1321, 1423, 1531, 1619, 1721, 1823, 1931, 2017, 2131, 2251,
  2371, 2503, 2647, 2791, 2917, 3061, 3203, 3331, 3469, 3613,
  3761, 3911, 4051, 4211, 4357, 4513, 4657, 4813, 4969, 5113,
  5273, 5419, 5573, 5741, 5903, 6073, 6229, 6397, 6571, 6733,
  6907, 7079, 7243, 7411, 7583, 7759, 7919, 8087, 8263, 8443,
  8623, 8803, 8971, 9151, 9323, 9497, 9677, 9851, 10037, 10211,
  10391, 10567, 10753, 10937, 11117, 11299, 11483, 11657, 11839, 12011,
  12197, 12379, 12553, 12739, 12919, 13099, 13291, 13469, 13657, 13829,
];

export function parseCsv(value, fallback) {
  if (!value) return [...fallback];
  const wanted = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return wanted.length ? wanted : [...fallback];
}

export function getSoakTier() {
  const tier = String(process.env.SOAK_TIER ?? "fast").toLowerCase();
  return SOAK_TIER_CONFIG[tier] ? tier : "fast";
}

export function getSoakTierConfig(tier = getSoakTier()) {
  const base = SOAK_TIER_CONFIG[tier] ?? SOAK_TIER_CONFIG.fast;
  return {
    ...base,
    seedCount: Math.max(1, Number(process.env.SOAK_SEED_COUNT ?? base.seedCount)),
    handsPerScenario: Math.max(1, Number(process.env.SOAK_HANDS ?? base.handsPerScenario)),
    timeoutMs: Math.max(30000, Number(process.env.SOAK_TIMEOUT_MS ?? base.timeoutMs)),
    traceMode: process.env.SOAK_TRACE_MODE ?? base.traceMode,
  };
}

export function resolveSoakSeeds(config = getSoakTierConfig()) {
  const explicit = parseCsv(process.env.SOAK_SEEDS, []);
  if (explicit.length) {
    return explicit.map((seed) => Number(seed)).filter((seed) => Number.isFinite(seed));
  }
  return SOAK_BASE_SEEDS.slice(0, config.seedCount);
}

export function resolveSoakVariants() {
  const ids = parseCsv(process.env.SOAK_VARIANTS, CORE5_SOAK_VARIANTS.map((variant) => variant.id));
  const wanted = new Set(ids.map((id) => id.toLowerCase()));
  return CORE5_SOAK_VARIANTS.filter((variant) => wanted.has(variant.id.toLowerCase()));
}

export function resolveSoakModes(defaultModes = SOAK_MODES) {
  const modes = parseCsv(process.env.SOAK_MODES, defaultModes);
  const wanted = new Set(modes.map((mode) => mode.toLowerCase()));
  return SOAK_MODES.filter((mode) => wanted.has(mode));
}

export function resolveSoakViewports(defaultViewports = [SOAK_VIEWPORTS[0]]) {
  const ids = parseCsv(process.env.SOAK_VIEWPORTS, defaultViewports.map((viewport) => viewport.id));
  const wanted = new Set(ids.map((id) => id.toLowerCase()));
  return SOAK_VIEWPORTS.filter((viewport) => wanted.has(viewport.id.toLowerCase()));
}

export function policyForSeed(seed) {
  const policies = ["safe", "heroAggressive", "heroThenFold", "foldNonHero"];
  return policies[Math.abs(Number(seed) || 0) % policies.length];
}

export function buildRoundRobinScenarios({
  modes = SOAK_MODES,
  viewports = [SOAK_VIEWPORTS[0]],
  scenarioPrefix = "core5",
} = {}) {
  const config = getSoakTierConfig();
  const seeds = resolveSoakSeeds(config);
  const variants = resolveSoakVariants();
  const selectedModes = resolveSoakModes(modes);
  const selectedViewports = resolveSoakViewports(viewports);

  return seeds.map((seed, index) => {
    const variant = variants[index % variants.length];
    const mode = selectedModes[index % selectedModes.length];
    const viewport = selectedViewports[index % selectedViewports.length];
    const policy = policyForSeed(seed + index);
    return {
      id: [
        scenarioPrefix,
        variant.id.toLowerCase(),
        mode,
        viewport.id,
        `seed-${seed}`,
      ].join("-"),
      tier: getSoakTier(),
      seed,
      variant,
      mode,
      viewport,
      policy,
      hands: config.handsPerScenario,
      maxSteps: Math.max(variant.maxSteps, Number(process.env.SOAK_MAX_STEPS ?? 0) || variant.maxSteps),
      timeoutMs: config.timeoutMs,
      traceMode: config.traceMode,
    };
  });
}

export function buildCrossVariantScenario() {
  const config = getSoakTierConfig();
  return {
    id: `cross-variant-core5-${getSoakTier()}`,
    tier: getSoakTier(),
    seed: resolveSoakSeeds(config)[0] ?? SOAK_BASE_SEEDS[0],
    variants: resolveSoakVariants(),
    mode: "cash",
    viewport: SOAK_VIEWPORTS[0],
    policy: "safe",
    hands: 1,
    maxSteps: Number(process.env.SOAK_MAX_STEPS ?? 120),
    timeoutMs: config.timeoutMs,
    traceMode: config.traceMode,
  };
}
