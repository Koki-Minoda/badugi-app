import { GAME_VARIANTS } from "../../config/variantCatalog.js";
import { getProgressHarnessStatus, runProgressScenario } from "./runProgressScenario.js";

export const VARIANT_FAMILIES = Object.freeze({
  DRAW: "DRAW",
  STUD: "STUD",
  FLOP_HOLDEM: "FLOP_HOLDEM",
  FLOP_OMAHA: "FLOP_OMAHA",
  SPLIT_POT: "SPLIT_POT",
  MIXED: "MIXED",
  SPECIAL: "SPECIAL",
  CHINESE: "CHINESE",
});

const FLOP_HOLDEM_IDS = new Set(["B01", "B02", "B03", "B04"]);
const FLOP_OMAHA_IDS = new Set(["B05", "B06", "B07", "B08", "B09"]);
const SPLIT_POT_IDS = new Set(["B06", "B09", "D04", "D05", "S05", "S06", "ST2", "ST4", "ST5"]);
const SPECIAL_IDS = new Set(["B03", "B04", "H01", "H02", "H03", "H04", "H05", "H06"]);

function isImplementedVariant(variant = {}) {
  return ["live", "playable", "in-progress", "wip"].includes(String(variant.status ?? ""));
}

export function getVariantFamilies(variant = {}) {
  const families = new Set();
  const evaluators = variant.evaluators ?? [];
  const features = variant.features ?? [];

  if (variant.category === "triple-draw" || variant.category === "single-draw") {
    families.add(VARIANT_FAMILIES.DRAW);
  }
  if (variant.category === "stud") {
    families.add(VARIANT_FAMILIES.STUD);
  }
  if (FLOP_HOLDEM_IDS.has(variant.id)) {
    families.add(VARIANT_FAMILIES.FLOP_HOLDEM);
  }
  if (FLOP_OMAHA_IDS.has(variant.id)) {
    families.add(VARIANT_FAMILIES.FLOP_OMAHA);
  }
  if (
    SPLIT_POT_IDS.has(variant.id) ||
    evaluators.some((tag) => /split|hi-lo/i.test(tag)) ||
    features.some((tag) => /split|hi-lo/i.test(tag))
  ) {
    families.add(VARIANT_FAMILIES.SPLIT_POT);
  }
  if (variant.category === "dramaha" || SPECIAL_IDS.has(variant.id)) {
    families.add(VARIANT_FAMILIES.SPECIAL);
  }
  if (variant.category === "chinese") {
    families.add(VARIANT_FAMILIES.CHINESE);
  }

  return Array.from(families);
}

export function listVariantsByFamily(family, { includeUnimplemented = false } = {}) {
  if (family === VARIANT_FAMILIES.MIXED) return [];
  return GAME_VARIANTS.filter((variant) => {
    if (!includeUnimplemented && !isImplementedVariant(variant)) return false;
    return getVariantFamilies(variant).includes(family);
  });
}

function buildSkipResult({ family, variant, scenario, seed, reason }) {
  return {
    family,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? variant?.label ?? variant?.id ?? "unknown",
    scenario,
    seed,
    status: "skipped",
    reason,
  };
}

export function runVariantFamilyScenario({
  family,
  scenario = "cash-10-hands-smoke",
  seed = "mgx-family-progress",
  maxSteps = 500,
  includeVariants = null,
  excludeVariants = [],
  invariantContext = {},
} = {}) {
  const includeSet = includeVariants ? new Set(includeVariants) : null;
  const excludeSet = new Set(excludeVariants);
  const variants = listVariantsByFamily(family, { includeUnimplemented: true }).filter((variant) => {
    if (includeSet && !includeSet.has(variant.id)) return false;
    return !excludeSet.has(variant.id);
  });

  if (!variants.length) {
    return {
      family,
      scenario,
      seed,
      status: "skipped",
      tested: [],
      skipped: [
        {
          family,
          variantId: null,
          scenario,
          seed,
          status: "skipped",
          reason: `No variants registered for family=${family}`,
        },
      ],
      failed: [],
    };
  }

  const tested = [];
  const skipped = [];
  const failed = [];

  variants.forEach((variant) => {
    if (!isImplementedVariant(variant)) {
      skipped.push(
        buildSkipResult({
          family,
          variant,
          scenario,
          seed,
          reason: `variant not implemented: status=${variant.status}`,
        }),
      );
      return;
    }
    const harness = getProgressHarnessStatus(variant.id);
    if (!harness.supported) {
      skipped.push(
        buildSkipResult({
          family,
          variant,
          scenario,
          seed,
          reason: harness.reason ?? "progress harness not supported",
        }),
      );
      return;
    }

    try {
      const result = runProgressScenario({
        variantId: variant.id,
        scenarioId: scenario,
        seed: `${seed}-${variant.id}`,
        maxSteps,
        invariantContext: {
          maxDrawRounds: variant.drawRounds,
          handCardCount: variant.holeCards,
          maxDiscardCount: variant.holeCards,
          enforceHandSize:
            variant.category === "triple-draw" ||
            variant.category === "single-draw" ||
            variant.category === "dramaha",
          ...invariantContext,
        },
      });
      if (result.status === "skipped") skipped.push({ family, ...result });
      else tested.push({ family, ...result });
    } catch (error) {
      failed.push({
        family,
        variantId: variant.id,
        variantName: variant.name ?? variant.label ?? variant.id,
        scenario,
        seed: `${seed}-${variant.id}`,
        status: "failed",
        error: error?.message ?? String(error),
      });
    }
  });

  return {
    family,
    scenario,
    seed,
    status: failed.length ? "failed" : tested.length ? "passed" : "skipped",
    tested,
    skipped,
    failed,
  };
}

export function summarizeFamilyCoverage(family) {
  const variants = listVariantsByFamily(family, { includeUnimplemented: true });
  const implemented = variants.filter(isImplementedVariant);
  const supported = implemented.filter((variant) => getProgressHarnessStatus(variant.id).supported);
  const skipped = implemented.filter((variant) => !getProgressHarnessStatus(variant.id).supported);
  return {
    family,
    variantsFound: variants.length,
    implemented: implemented.length,
    supported: supported.length,
    skipped: skipped.map((variant) => ({
      variantId: variant.id,
      reason: getProgressHarnessStatus(variant.id).reason ?? "progress harness not supported",
    })),
  };
}
