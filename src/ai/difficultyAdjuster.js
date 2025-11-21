import tiers from "../../config/ai/tiers.json" assert { type: "json" };
import { getTierById } from "./tierManager.js";

const TIER_ORDER = tiers.map((tier) => tier.id);
const DRAW_TARGETS = {
  beginner: 2.4,
  standard: 1.8,
  strong: 1.2,
  pro: 0.9,
  iron: 0.6,
  worldmaster: 0.4,
};

function normalizeRange(range = []) {
  const lower = typeof range[0] === "number" ? range[0] : 0;
  const upper = typeof range[1] === "number" ? range[1] : lower;
  if (upper < lower) {
    return [upper, lower];
  }
  return [lower, upper];
}

function rangePenalty(value = 0, range, tolerance = 0.02) {
  if (!Array.isArray(range) || range.length === 0) return 0;
  const [min, max] = normalizeRange(range);
  if (value >= min - tolerance && value <= max + tolerance) return 0;
  if (value < min) return (min - value) / Math.max(0.001, max - min);
  if (value > max) return (value - max) / Math.max(0.001, max - min);
  return 0;
}

function closenessPenalty(value = 0, target = 0, tolerance = 0.05) {
  const diff = Math.abs(value - target);
  if (diff <= tolerance) return 0;
  return diff;
}

export function evaluateTierFit(tierId, stats) {
  const tierConfig = getTierById(tierId);
  if (!tierConfig) {
    return {
      tierId,
      score: Number.POSITIVE_INFINITY,
    };
  }
  const vpipScore = rangePenalty(stats?.vpipRate ?? 0, tierConfig.vpipRange, 0.015);
  const pfrScore = rangePenalty(stats?.pfrRate ?? 0, tierConfig.pfrRange ?? tierConfig.vpipRange, 0.01);
  const drawTarget = DRAW_TARGETS[tierConfig.id] ?? 1;
  const drawScore = closenessPenalty(stats?.drawCountAvg ?? drawTarget, drawTarget, 0.15);
  const limpAllowance = tierConfig.id === "beginner" ? 0.25 : tierConfig.id === "standard" ? 0.15 : 0.08;
  const limpScore = Math.max(0, (stats?.limpRate ?? 0) - limpAllowance);

  const score =
    vpipScore * 0.5 +
    pfrScore * 0.3 +
    drawScore * 0.15 +
    limpScore * 0.05;

  return { tierId: tierConfig.id, score };
}

export function suggestDynamicTier({ baseTierId, stats, minSamples = 30, maxStep = 1 }) {
  const actions = stats?.samples?.actions ?? 0;
  if (!baseTierId || actions < minSamples) {
    return baseTierId;
  }
  const baseIndex = Math.max(0, TIER_ORDER.indexOf(baseTierId));
  const searchIds = new Set();
  for (let offset = -maxStep; offset <= maxStep; offset += 1) {
    const idx = Math.min(TIER_ORDER.length - 1, Math.max(0, baseIndex + offset));
    searchIds.add(TIER_ORDER[idx]);
  }
  let bestTierId = baseTierId;
  let bestScore = Number.POSITIVE_INFINITY;
  searchIds.forEach((tierId) => {
    const { score } = evaluateTierFit(tierId, stats);
    if (score < bestScore - 0.001) {
      bestScore = score;
      bestTierId = tierId;
    }
  });
  return bestTierId;
}
