import {
  GAME_VARIANT_CATEGORIES,
  GAME_VARIANTS,
  getVariantById,
} from "./variantCatalog.js";
import { deriveRequirementsForVariant } from "../core/requirements.js";
import { getProRulesForVariant } from "./proRules.js";

export const VARIANT_CATEGORY_LABELS = Object.freeze({
  [GAME_VARIANT_CATEGORIES.BOARD]: "Board / Hold'em / Omaha",
  [GAME_VARIANT_CATEGORIES.TRIPLE_DRAW]: "Triple Draw",
  [GAME_VARIANT_CATEGORIES.SINGLE_DRAW]: "Single Draw",
  [GAME_VARIANT_CATEGORIES.DRAMAHA]: "Dramaha",
  [GAME_VARIANT_CATEGORIES.STUD]: "Stud",
});

export function getVariantProfile(idOrVariant) {
  const variant =
    typeof idOrVariant === "string" ? getVariantById(idOrVariant) : idOrVariant;
  if (!variant) return null;
  const requirements = deriveRequirementsForVariant(variant);
  return {
    id: variant.id,
    name: variant.name,
    status: variant.status ?? "planned",
    category: variant.category,
    description: variant.description ?? "",
    holeCards: variant.holeCards ?? null,
    drawRounds: variant.drawRounds ?? 0,
    board: variant.board ?? null,
    stud: variant.stud ?? null,
    betting: variant.betting ?? "fixed-limit",
    evaluators: variant.evaluators ?? [],
    priorityPhase: variant.priorityPhase ?? 0,
    tags: variant.tags ?? [],
    engineKey: variant.engineKey ?? null,
    requirements,
    summary: buildSummary(variant, requirements),
  };
}

export function listVariantProfiles({ category } = {}) {
  return GAME_VARIANTS.filter((variant) =>
    category ? variant.category === category : true
  ).map((variant) => getVariantProfile(variant));
}

export function searchVariantProfiles(query = "") {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return GAME_VARIANTS.map((variant) => getVariantProfile(variant));
  return GAME_VARIANTS.filter((variant) => {
    const haystack = `${variant.id} ${variant.name} ${variant.description ?? ""} ${
      (variant.tags ?? []).join(" ")
    }`.toLowerCase();
    return haystack.includes(normalized);
  }).map((variant) => getVariantProfile(variant));
}

export function variantStatusBadge(profile) {
  if (!profile) return { label: "Unknown", tone: "neutral" };
  if (profile.status === "live") {
    return { label: "Live", tone: "success" };
  }
  if (profile.status === "wip") {
    return { label: "In Progress", tone: "warning" };
  }
  return { label: "Planned", tone: "muted" };
}

function buildSummary(variant, requirements) {
  if (!variant) return "";
  const parts = [];
  if (variant.holeCards) {
    parts.push(`${variant.holeCards} cards`);
  }
  if (variant.drawRounds) {
    parts.push(`${variant.drawRounds} draw${variant.drawRounds > 1 ? "s" : ""}`);
  } else if (variant.board?.type) {
    parts.push(`Board: ${variant.board.type}`);
  } else if (variant.stud) {
    parts.push("Stud streets");
  }
  if (variant.betting) {
    parts.push(variant.betting.replace("-", " "));
  }
  if (requirements?.needsSplitPot) {
    parts.push("Split pot");
  }
  return parts.join("; ");
}

const CATEGORY_PROFILE_DEFAULTS = {
  [GAME_VARIANT_CATEGORIES.BOARD]: {
    startingStack: 200,
    forcedBets: { type: "blinds", smallBlind: 50, bigBlind: 100, ante: 0 },
  },
  [GAME_VARIANT_CATEGORIES.TRIPLE_DRAW]: {
    startingStack: 120,
    forcedBets: { type: "limit", smallBet: 4, bigBet: 8, ante: 0 },
  },
  [GAME_VARIANT_CATEGORIES.SINGLE_DRAW]: {
    startingStack: 120,
    forcedBets: { type: "limit", smallBet: 4, bigBet: 8, ante: 0 },
  },
  [GAME_VARIANT_CATEGORIES.DRAMAHA]: {
    startingStack: 150,
    forcedBets: { type: "mixed", ante: 1, bringIn: 2 },
  },
  [GAME_VARIANT_CATEGORIES.STUD]: {
    startingStack: 120,
    forcedBets: { type: "stud", ante: 1, bringIn: 3 },
  },
};

export function resolveGameProfile(idOrVariant) {
  const profile = getVariantProfile(idOrVariant);
  if (!profile) return null;
  const defaults = CATEGORY_PROFILE_DEFAULTS[profile.category] ?? {
    startingStack: 100,
    forcedBets: { type: "blinds", smallBlind: 1, bigBlind: 2, ante: 0 },
  };
  return {
    id: profile.id,
    name: profile.name,
    category: profile.category,
    betting: profile.betting,
    evaluators: profile.evaluators ?? [],
    startingStack: defaults.startingStack,
    forcedBets: defaults.forcedBets,
    proRules: getProRulesForVariant(profile.id),
  };
}
