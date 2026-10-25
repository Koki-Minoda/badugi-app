import registry from "../config/ai/modelRegistry.json" with { type: "json" };

const REGISTRY = registry.map((entry) => ({
  ...entry,
  variantIds: Array.isArray(entry.variantIds) ? entry.variantIds : [],
  characterIds: Array.isArray(entry.characterIds) ? entry.characterIds : [],
}));

export function getModelEntry(modelId) {
  return REGISTRY.find((entry) => entry.id === modelId) ?? null;
}

function pickMostSpecificEntry(entries) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const variantDelta = a.entry.variantIds.length - b.entry.variantIds.length;
      if (variantDelta !== 0) return variantDelta;
      return a.index - b.index;
    })[0]?.entry ?? null;
}

export function selectModelForVariant({ variantId, tierId, characterId, modelId, requireVariantMatch = false }) {
  const candidates = requireVariantMatch
    ? REGISTRY.filter(entry => entry.trainingStatus !== "pending" && variantId && entry.variantIds.includes(variantId))
    : REGISTRY;
  if (modelId) {
    const explicit = candidates.find(entry => entry.id === modelId);
    if (explicit) return explicit;
    if (requireVariantMatch) return null;
  }
  if (variantId && tierId && characterId) {
    const characterTier = pickMostSpecificEntry(candidates.filter(
      (entry) =>
        entry.variantIds.includes(variantId) &&
        entry.tier === tierId &&
        entry.characterIds.includes(characterId),
    ));
    if (characterTier) return characterTier;
  }
  if (variantId && tierId) {
    const exactTier = pickMostSpecificEntry(candidates.filter(
      (entry) =>
        entry.variantIds.includes(variantId) &&
        entry.tier === tierId &&
        entry.characterIds.length === 0,
    ));
    if (exactTier) return exactTier;
  }
  if (variantId && !tierId) {
    const exact = candidates.find(
      (entry) => entry.variantIds.includes(variantId) && entry.characterIds.length === 0,
    );
    if (exact) return exact;
  }
  if (tierId) {
    const tierMatch = candidates.find(
      (entry) =>
        entry.tier === tierId &&
        entry.characterIds.length === 0 &&
        (!variantId || entry.variantIds.length === 0),
    );
    if (tierMatch) return tierMatch;
  }
  return requireVariantMatch ? null : REGISTRY[REGISTRY.length - 1] ?? null;
}
