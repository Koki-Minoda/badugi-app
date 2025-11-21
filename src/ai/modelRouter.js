import registry from "../config/ai/modelRegistry.json";

const REGISTRY = registry.map((entry) => ({
  ...entry,
  variantIds: Array.isArray(entry.variantIds) ? entry.variantIds : [],
}));

export function getModelEntry(modelId) {
  return REGISTRY.find((entry) => entry.id === modelId) ?? null;
}

export function selectModelForVariant({ variantId, tierId }) {
  if (variantId) {
    const exact = REGISTRY.find((entry) => entry.variantIds.includes(variantId));
    if (exact) return exact;
  }
  if (tierId) {
    const tierMatch = REGISTRY.find((entry) => entry.tier === tierId);
    if (tierMatch) return tierMatch;
  }
  return REGISTRY[REGISTRY.length - 1] ?? null;
}
