import { getVariantById } from "../../games/config/variantCatalog.js";

export const DEFAULT_AI_PROFILE = Object.freeze({
  id: "ai-default",
  aggression: 0.5,
  bluffFrequency: 0.1,
  foldThreshold: 0.18,
  raiseThreshold: 0.9,
  raiseSizeMultiplier: 1,
  drawAggression: 0,
});

export const PRO_AI_PROFILES = Object.freeze([
  {
    id: "ai-badugi-pro",
    variantIds: ["D03"],
    aggression: 0.65,
    bluffFrequency: 0.2,
    foldThreshold: 0.12,
    raiseThreshold: 0.78,
    raiseSizeMultiplier: 1.25,
    drawAggression: -0.2,
    notes: "Badugi specialists pressure medium hands and draw aggressively when weak.",
  },
  {
    id: "ai-2-7-td-pro",
    variantIds: ["D01"],
    aggression: 0.6,
    bluffFrequency: 0.15,
    foldThreshold: 0.14,
    raiseThreshold: 0.82,
    raiseSizeMultiplier: 1.1,
    drawAggression: -0.1,
  },
  {
    id: "ai-board-pro",
    category: "board",
    aggression: 0.55,
    bluffFrequency: 0.22,
    foldThreshold: 0.17,
    raiseThreshold: 0.8,
    raiseSizeMultiplier: 1.3,
    drawAggression: 0,
  },
  {
    id: "ai-stud-pro",
    category: "stud",
    aggression: 0.52,
    bluffFrequency: 0.12,
    foldThreshold: 0.2,
    raiseThreshold: 0.86,
    raiseSizeMultiplier: 1.1,
    drawAggression: 0.15,
  },
  {
    id: "ai-triple-draw-pro",
    category: "triple-draw",
    aggression: 0.6,
    bluffFrequency: 0.18,
    foldThreshold: 0.16,
    raiseThreshold: 0.82,
    raiseSizeMultiplier: 1.15,
    drawAggression: -0.15,
  },
]);

function mergeProfile(base, override) {
  return Object.freeze({
    ...base,
    ...override,
  });
}

export function getProAiProfile(variantId) {
  if (!variantId) return DEFAULT_AI_PROFILE;
  const variant = getVariantById(variantId);
  const exact = PRO_AI_PROFILES.find((profile) =>
    Array.isArray(profile.variantIds) && profile.variantIds.includes(variantId)
  );
  if (exact) return mergeProfile(DEFAULT_AI_PROFILE, exact);
  const category = variant?.category ?? null;
  if (category) {
    const byCategory = PRO_AI_PROFILES.find(
      (profile) => profile.category && profile.category === category
    );
    if (byCategory) return mergeProfile(DEFAULT_AI_PROFILE, byCategory);
  }
  return DEFAULT_AI_PROFILE;
}

