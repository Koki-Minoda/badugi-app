import tiers from "../../config/ai/tiers.json" assert { type: "json" };
import { getStageById } from "../../config/tournamentStages.js";
import { selectModelForVariant } from "./modelRouter.js";

const TIER_MAP = new Map(tiers.map((tier) => [tier.id, Object.freeze(tier)]));
const TIER_ORDER = tiers.map((tier) => tier.id);

export function getTierById(tierId) {
  return TIER_MAP.get(tierId) ?? TIER_MAP.get("standard");
}

export function listTierIds() {
  return [...TIER_ORDER];
}

export function describeTierMetrics(tierConfig) {
  if (!tierConfig) return null;
  return {
    id: tierConfig.id,
    label: tierConfig.label,
    vpipRange: tierConfig.vpipRange ?? [],
    pfrRange: tierConfig.pfrRange ?? [],
    randomness: tierConfig.randomness ?? 0,
    latencyMs: tierConfig.latencyMs ?? [0, 0],
    discardAccuracy: tierConfig.discardAccuracy ?? 0,
    bluffWeight: tierConfig.bluffWeight ?? tierConfig.bluffFrequency ?? 0,
  };
}

function pickTierFromStage(stageId) {
  switch (stageId) {
    case "world":
      return "worldmaster";
    case "national":
      return "iron";
    case "local":
      return "pro";
    case "store":
    default:
      return "standard";
  }
}

export function resolveTierForContext({
  stageId = "store",
  tournamentDifficulty = 1,
  mixedProfile = null,
  dealerChoice = false,
}) {
  const stage = getStageById(stageId);
  const baseTier = pickTierFromStage(stage?.id ?? stageId);
  let tierId = baseTier;
  if (tournamentDifficulty >= 4) tierId = "iron";
  if (tournamentDifficulty >= 5) tierId = "worldmaster";
  if (dealerChoice) tierId = "pro";
  if (mixedProfile?.formatLabel?.toLowerCase().includes("dealer")) {
    tierId = "iron";
  }
  return getTierById(tierId);
}

export function resolveTierModelInfo({ variantId, tierId }) {
  const entry = selectModelForVariant({ variantId, tierId });
  if (!entry) return null;
  return {
    modelId: entry.id,
    tierId: entry.tier,
    variantIds: entry.variantIds,
    onnx: entry.onnx,
    inputShape: entry.inputShape,
    outputShape: entry.outputShape,
  };
}
