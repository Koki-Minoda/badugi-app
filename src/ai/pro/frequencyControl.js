import { legalActionTypes } from "./strategyUtils.js";

function normalizeActionMix(actionMix = []) {
  if (Array.isArray(actionMix)) {
    return actionMix
      .map((entry) => ({
        action: String(entry?.action ?? entry?.type ?? "").toUpperCase(),
        weight: Math.max(0, Number(entry?.weight ?? entry?.frequency ?? 0) || 0),
      }))
      .filter((entry) => entry.action && entry.weight > 0);
  }
  if (actionMix && typeof actionMix === "object") {
    return Object.entries(actionMix)
      .map(([action, weight]) => ({
        action: String(action ?? "").toUpperCase(),
        weight: Math.max(0, Number(weight) || 0),
      }))
      .filter((entry) => entry.action && entry.weight > 0);
  }
  return [];
}

function hashString(value = "") {
  let hash = 2166136261;
  const input = String(value ?? "");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function chooseByFrequency({
  seed = 0,
  handId = "",
  seatIndex = 0,
  variantId = "",
  actionMix = [],
  legalActions = [],
  context = {},
} = {}) {
  const legal = new Set(legalActionTypes(legalActions));
  const candidates = normalizeActionMix(actionMix).filter((entry) => legal.has(entry.action));
  if (!candidates.length) {
    return null;
  }
  const totalWeight = candidates.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }
  const basis = JSON.stringify({
    seed,
    handId,
    seatIndex,
    variantId,
    context,
  });
  const bucket = hashString(basis) % totalWeight;
  let cursor = 0;
  for (const candidate of candidates) {
    cursor += candidate.weight;
    if (bucket < cursor) {
      return {
        action: candidate.action,
        reason: `frequency-${candidate.action.toLowerCase()}`,
        frequencyBucket: `${bucket}/${totalWeight}`,
      };
    }
  }
  const fallback = candidates[candidates.length - 1];
  return {
    action: fallback.action,
    reason: `frequency-${fallback.action.toLowerCase()}`,
    frequencyBucket: `${bucket}/${totalWeight}`,
  };
}
