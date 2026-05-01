import registry from "../config/ai/modelRegistry.json";

const REGISTRY = registry.map((entry) => ({
  ...entry,
  variantIds: Array.isArray(entry.variantIds) ? entry.variantIds : [],
  characterIds: Array.isArray(entry.characterIds) ? entry.characterIds : [],
}));

export function getModelEntry(modelId) {
  return REGISTRY.find((entry) => entry.id === modelId) ?? null;
}

export function selectModelForVariant({ variantId, tierId, characterId, modelId }) {
  if (modelId) {
    const explicit = getModelEntry(modelId);
    if (explicit) return explicit;
  }
  if (variantId && tierId && characterId) {
    const characterTier = REGISTRY.find(
      (entry) =>
        entry.variantIds.includes(variantId) &&
        entry.tier === tierId &&
        entry.characterIds.includes(characterId),
    );
    if (characterTier) return characterTier;
  }
  if (variantId && tierId) {
    const exactTier = REGISTRY.find(
      (entry) =>
        entry.variantIds.includes(variantId) &&
        entry.tier === tierId &&
        entry.characterIds.length === 0,
    );
    if (exactTier) return exactTier;
  }
  if (variantId) {
    const exact = REGISTRY.find(
      (entry) => entry.variantIds.includes(variantId) && entry.characterIds.length === 0,
    );
    if (exact) return exact;
  }
  if (tierId) {
    const tierMatch = REGISTRY.find((entry) => entry.tier === tierId);
    if (tierMatch) return tierMatch;
  }
  return REGISTRY[REGISTRY.length - 1] ?? null;
}
