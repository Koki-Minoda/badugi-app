export const BASE_TOURNAMENT_VARIANT_ID = "badugi";

export const TOURNAMENT_VARIANTS = [
  {
    id: "badugi",
    label: "Badugi",
    gameVariant: "badugi",
    initiallyUnlocked: true,
  },
  {
    id: "2-7td",
    label: "2-7 Triple Draw",
    gameVariant: "D01",
  },
  {
    id: "a5td",
    label: "A-5 Triple Draw",
    gameVariant: "D02",
  },
  {
    id: "razz",
    label: "Razz",
    gameVariant: "razz",
  },
  {
    id: "stud",
    label: "Stud",
    gameVariant: "stud",
  },
];

export const TOURNAMENT_UNLOCKS = [
  {
    id: "unlock-27td",
    requires: {
      variant: "badugi",
      stage: "world",
      result: "champion",
    },
    unlocks: {
      variant: "2-7td",
    },
  },
  {
    id: "unlock-a5td",
    requires: {
      variant: "2-7td",
      stage: "world",
      result: "champion",
    },
    unlocks: {
      variant: "a5td",
    },
  },
  {
    id: "unlock-razz",
    requires: {
      variant: "a5td",
      stage: "world",
      result: "champion",
    },
    unlocks: {
      variant: "razz",
    },
  },
  {
    id: "unlock-stud",
    requires: {
      variant: "razz",
      stage: "world",
      result: "champion",
    },
    unlocks: {
      variant: "stud",
    },
  },
];

const STAGE_IDS = ["store", "local", "national", "world"];

function normalizeVariantId(variant) {
  const value = String(variant ?? "").trim().toLowerCase();
  if (["d01", "27td", "2-7-triple-draw", "deuce_to_seven_triple_draw"].includes(value)) {
    return "2-7td";
  }
  if (["d02", "a5td", "a-5-triple-draw", "ace_to_five_triple_draw"].includes(value)) {
    return "a5td";
  }
  return value || BASE_TOURNAMENT_VARIANT_ID;
}

function isChampionResult(entry, requirement) {
  const finishPlace = Number(entry?.finishPlace ?? entry?.placement);
  const result = String(entry?.result ?? "").toLowerCase();
  const requiresChampion = requirement?.result === "champion";
  return requiresChampion ? finishPlace === 1 || result === "champion" : true;
}

function hasCompletedRequirement(progress, requirement) {
  const completed = Array.isArray(progress?.completedTournaments)
    ? progress.completedTournaments
    : [];
  const requiredVariant = normalizeVariantId(requirement?.variant);
  const requiredStage = String(requirement?.stage ?? "").toLowerCase();
  return completed.some((entry) => {
    const entryVariant = normalizeVariantId(entry?.variant ?? entry?.gameVariant);
    const entryStage = String(entry?.stage ?? entry?.stageId ?? "").toLowerCase();
    return (
      entryVariant === requiredVariant &&
      entryStage === requiredStage &&
      isChampionResult(entry, requirement)
    );
  });
}

export function getTournamentVariantById(variantId) {
  const normalized = normalizeVariantId(variantId);
  return TOURNAMENT_VARIANTS.find((variant) => variant.id === normalized) ?? null;
}

export function getUnlockForVariant(variantId) {
  const normalized = normalizeVariantId(variantId);
  return TOURNAMENT_UNLOCKS.find(
    (unlock) => normalizeVariantId(unlock.unlocks?.variant) === normalized,
  ) ?? null;
}

export function formatUnlockRequirement(unlock) {
  if (!unlock?.requires) return "";
  const variant = getTournamentVariantById(unlock.requires.variant);
  const stage = String(unlock.requires.stage ?? "");
  const stageLabel =
    stage === "world"
      ? "World Championship"
      : `${stage.charAt(0).toUpperCase()}${stage.slice(1)} Tournament`;
  return `Win ${variant?.label ?? unlock.requires.variant} ${stageLabel} to unlock`;
}

export function evaluateTournamentUnlocks(progress = {}) {
  const unlockedVariants = new Set(
    TOURNAMENT_VARIANTS.filter((variant) => variant.initiallyUnlocked).map(
      (variant) => variant.id,
    ),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const unlock of TOURNAMENT_UNLOCKS) {
      const targetVariant = normalizeVariantId(unlock.unlocks?.variant);
      if (unlockedVariants.has(targetVariant)) continue;
      if (hasCompletedRequirement(progress, unlock.requires)) {
        unlockedVariants.add(targetVariant);
        changed = true;
      }
    }
  }
  return {
    unlockedVariants: [...unlockedVariants],
    unlockedStages: STAGE_IDS,
  };
}
