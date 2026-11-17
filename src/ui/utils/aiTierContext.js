import { TOURNAMENT_STAGE_IDS } from "../../config/tournamentStages.js";
import { getTierById, resolveTierForContext } from "../../ai/tierManager.js";

// Keep Standard as the default; users can explicitly select evaluated tiers.
export const DEFAULT_CASH_AI_TIER_ID = "standard";
export const DEFAULT_TOURNAMENT_STAGE_ID = "store";

function normalizeStageCandidate(value) {
  if (!value) return null;
  const candidate = String(value).trim().toLowerCase();
  if (TOURNAMENT_STAGE_IDS.includes(candidate)) return candidate;
  const prefix = candidate.match(
    /^(store|local|national|world)(?:[-_]|$)/,
  )?.[1];
  return prefix && TOURNAMENT_STAGE_IDS.includes(prefix) ? prefix : null;
}

export function resolveTournamentStageId({
  config = null,
  tournamentSession = null,
} = {}) {
  return (
    normalizeStageCandidate(config?.stageId) ??
    normalizeStageCandidate(config?.stage?.id) ??
    normalizeStageCandidate(config?.metadata?.stageId) ??
    normalizeStageCandidate(config?.id) ??
    normalizeStageCandidate(tournamentSession?.stageId) ??
    DEFAULT_TOURNAMENT_STAGE_ID
  );
}

export function resolveAiTierForGameContext({
  mode = "cash",
  config = null,
  tournamentSession = null,
  devTierOverride = null,
  cashTierId = null,
} = {}) {
  if (devTierOverride) {
    return getTierById(devTierOverride);
  }
  if (mode === "tournament-mtt" || mode === "tournament") {
    if (config?.practiceOnly && ["beginner", "standard", "pro"].includes(config.aiTierId)) {
      return getTierById(config.aiTierId);
    }
    return resolveTierForContext({
      stageId: resolveTournamentStageId({ config, tournamentSession }),
    });
  }
  if (["beginner", "standard", "pro"].includes(cashTierId)) return getTierById(cashTierId);
  return getTierById(DEFAULT_CASH_AI_TIER_ID);
}
