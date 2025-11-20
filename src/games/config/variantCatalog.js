import rawVariants from "./multiGameList.json" assert { type: "json" };
import rawPriority from "./variantPriority.data.json" assert { type: "json" };

export const GAME_VARIANT_CATEGORIES = Object.freeze({
  BOARD: "board",
  TRIPLE_DRAW: "triple-draw",
  SINGLE_DRAW: "single-draw",
  DRAMAHA: "dramaha",
  STUD: "stud",
});

export const BETTING_STRUCTURES = Object.freeze({
  NO_LIMIT: "no-limit",
  FIXED_LIMIT: "fixed-limit",
  POT_LIMIT: "pot-limit",
});

export const EVALUATOR_TAGS = Object.freeze({
  HIGH: "high",
  LOW_27: "low-27",
  LOW_A5: "low-a5",
  HI_LO_8_SPLIT: "hi-lo-8-split",
  BADUGI_LOW: "badugi-low",
  BADUGI_HIGH: "badugi-high",
  SPLIT_BADUGI_27: "split-badugi-27",
  SPLIT_BADUGI_A5: "split-badugi-a5",
  ARCHIE: "archie",
  ZERO: "zero",
});

export const EVALUATOR_DEFINITIONS = Object.freeze({
  [EVALUATOR_TAGS.HIGH]: {
    label: "High-hand",
    description: "Standard high-hand ranking (best five cards wins).",
  },
  [EVALUATOR_TAGS.LOW_27]: {
    label: "2-7 Lowball",
    description: "Straights/flushes hurt, ace counts high.",
  },
  [EVALUATOR_TAGS.LOW_A5]: {
    label: "A-5 Lowball",
    description: "Straights/flushes ignored, ace plays low.",
  },
  [EVALUATOR_TAGS.HI_LO_8_SPLIT]: {
    label: "Hi-Lo Split (8 or better)",
    description: "Pot split between best high hand and qualifying low hand (8-or-better).",
  },
  [EVALUATOR_TAGS.BADUGI_LOW]: {
    label: "Badugi Low",
    description: "Four-card draw using unique ranks/suits (Badugi).",
  },
  [EVALUATOR_TAGS.BADUGI_HIGH]: {
    label: "Badugi High",
    description: "Reverse Badugi ? highest valid Badugi wins.",
  },
  [EVALUATOR_TAGS.SPLIT_BADUGI_27]: {
    label: "Badugi / 2-7 Split",
    description: "Half pot to Badugi low, half to 2-7 lowball.",
  },
  [EVALUATOR_TAGS.SPLIT_BADUGI_A5]: {
    label: "Badugi / A-5 Split",
    description: "Half pot to Badugi low, half to A-5 lowball.",
  },
  [EVALUATOR_TAGS.ARCHIE]: {
    label: "Archie",
    description: "Custom evaluator used by Archie draw variants (pair + wheel).",
  },
  [EVALUATOR_TAGS.ZERO]: {
    label: "Zero Hand",
    description: "Dramaha variant scoring towards zero total.",
  },
});

const freezeOptional = (value) => {
  if (!value || typeof value !== "object") return value ?? null;
  return Object.freeze({ ...value });
};

const VARIANT_INDEX = new Map();

export const GAME_VARIANTS = Object.freeze(
  rawVariants.map((variant) => {
    const normalized = {
      ...variant,
      tags: Object.freeze(variant.tags ?? []),
      evaluators: Object.freeze(variant.evaluators ?? []),
      features: Object.freeze(variant.features ?? []),
      board: freezeOptional(variant.board),
      stud: freezeOptional(variant.stud),
      status: variant.status ?? "planned",
    };
    normalized.regenerationEligible = normalized.status !== "live";
    const frozen = Object.freeze(normalized);
    VARIANT_INDEX.set(frozen.id, frozen);
    return frozen;
  })
);

export const ENGINE_PRIORITY_PHASES = Object.freeze(
  rawPriority.map((phase) =>
    Object.freeze({
      ...phase,
      variantIds: Object.freeze([...phase.variantIds]),
    })
  )
);

export function getVariantById(id) {
  if (!id) return null;
  return VARIANT_INDEX.get(id) ?? null;
}

export function getVariantsByCategory(category) {
  return GAME_VARIANTS.filter((variant) => variant.category === category);
}

export function getEngineTemplateContext(id) {
  const variant = getVariantById(id);
  if (!variant) return null;
  const engineKey =
    variant.engineKey ||
    (variant.id ? variant.id.toLowerCase() : null);
  return {
    engineId: engineKey,
    category: variant.category,
    holeCards: variant.holeCards,
    drawRounds: variant.drawRounds,
    board: variant.board,
    betting: variant.betting,
    evaluators: variant.evaluators,
    implemented: variant.status === "live",
  };
}

export function listVariantsForPhase(phaseNumber) {
  const phase = ENGINE_PRIORITY_PHASES.find((p) => p.phase === phaseNumber);
  if (!phase) return [];
  return phase.variantIds
    .map((variantId) => getVariantById(variantId))
    .filter(Boolean);
}
