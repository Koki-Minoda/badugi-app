import { GAME_VARIANT_CATEGORIES, getVariantById } from "./variantCatalog.js";

const CATEGORY_RULE_DEFAULTS = Object.freeze({
  [GAME_VARIANT_CATEGORIES.BOARD]: {
    killBlind: {
      enabled: true,
      label: "Kill Blind",
      triggerConsecutiveWins: 2,
      minPotBigBlinds: 8,
      multiplier: 2,
    },
  },
  [GAME_VARIANT_CATEGORIES.STUD]: {
    requiresBringIn: true,
  },
});

const VARIANT_RULE_OVERRIDES = Object.freeze({
  S01: {
    requiresDeclaration: true,
    killBlind: null,
  },
  S02: {
    requiresDeclaration: true,
    killBlind: null,
  },
  B06: {
    killBlind: {
      minPotBigBlinds: 10,
      multiplier: 2,
    },
  },
  B09: {
    killBlind: {
      minPotBigBlinds: 6,
      triggerConsecutiveWins: 1,
      multiplier: 1.5,
    },
  },
  ST1: {
    requiresDeclaration: false,
  },
  ST2: {
    requiresDeclaration: false,
  },
  ST3: {
    requiresDeclaration: false,
  },
});

function normalizeKillRule(config) {
  if (!config || Object.keys(config).length === 0) return null;
  if (config.enabled === false) return null;
  const merged = {
    label: config.label ?? "Kill Blind",
    triggerConsecutiveWins:
      typeof config.triggerConsecutiveWins === "number" && config.triggerConsecutiveWins > 0
        ? config.triggerConsecutiveWins
        : 2,
    minPotBigBlinds:
      typeof config.minPotBigBlinds === "number" && config.minPotBigBlinds > 0
        ? config.minPotBigBlinds
        : 8,
    multiplier:
      typeof config.multiplier === "number" && config.multiplier > 1
        ? config.multiplier
        : 2,
  };
  return Object.freeze(merged);
}

export function getProRulesForVariant(idOrVariant) {
  const variant = typeof idOrVariant === "string" ? getVariantById(idOrVariant) : idOrVariant;
  if (!variant) return null;
  const categoryDefaults = CATEGORY_RULE_DEFAULTS[variant.category] ?? {};
  const overrides = VARIANT_RULE_OVERRIDES[variant.id] ?? {};
  const requiresBringIn =
    overrides.requiresBringIn ?? categoryDefaults.requiresBringIn ?? false;
  const requiresDeclaration =
    overrides.requiresDeclaration ?? categoryDefaults.requiresDeclaration ?? false;
  let killConfig = null;
  if (overrides.killBlind === null) {
    killConfig = null;
  } else if (categoryDefaults.killBlind || overrides.killBlind) {
    killConfig = {
      ...(categoryDefaults.killBlind ?? {}),
      ...(overrides.killBlind ?? {}),
    };
  }
  const killBlind = normalizeKillRule(killConfig);

  return Object.freeze({
    requiresBringIn: Boolean(requiresBringIn),
    requiresDeclaration: Boolean(requiresDeclaration),
    killBlind,
  });
}
