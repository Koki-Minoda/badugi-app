import { clone, getCurrentBet, normalizeActionType } from "./runAiEvaluationBatch.js";
import { getActorIndex, isReplayActionStillLegal } from "./replayDivergenceAction.js";

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function hasLegalAction(legalActions = [], targetType = "") {
  const wanted = String(targetType ?? "").toUpperCase();
  return (Array.isArray(legalActions) ? legalActions : []).some(
    (action) => String(action?.type ?? action).toUpperCase() === wanted,
  );
}

function normalizeLegalActionStub(action = null) {
  const type = normalizeActionType(action);
  return type ? { type, amount: 0, discardIndexes: [] } : null;
}

export function classifyReplayInvalidReason({
  sample,
  action,
  refreshedLegalActions = [],
  replayResult,
  actorSeat,
  snapshot = {},
} = {}) {
  const actionType = normalizeActionType(action);
  const error = String(replayResult?.errors?.[0] ?? replayResult?.invalidDetails?.[0]?.error ?? replayResult?.invalidReason ?? "").toLowerCase();
  const invalidReason = String(replayResult?.invalidReason ?? replayResult?.invalidDetails?.[0]?.invalidReason ?? "").toUpperCase();
  const raiseCount = toNumber(snapshot?.metadata?.raiseCountThisRound ?? snapshot?.raiseCountThisRound, 0);
  const actorStack = toNumber(snapshot?.players?.[actorSeat]?.stack, 0);
  const toCall = Math.max(
    0,
    ...refreshedLegalActions
      .map((legalAction) => toNumber(legalAction?.toCall))
      .filter((value) => Number.isFinite(value)),
  );
  if (error.includes("raise cap reached")) return "RAISE_CAP_REACHED";
  if (actionType === "RAISE" && !hasLegalAction(refreshedLegalActions, "RAISE") && hasLegalAction(refreshedLegalActions, "CALL")) {
    return raiseCount > 0 ? "STALE_RAISE" : "ACTION_NOT_IN_REFRESHED_LEGAL";
  }
  if (!hasLegalAction(refreshedLegalActions, actionType)) return "ACTION_NOT_IN_REFRESHED_LEGAL";
  if (invalidReason === "STACK_INSUFFICIENT" || actorStack < toCall) return "STACK_CONSTRAINT";
  if (Number.isInteger(actorSeat) && getActorIndex(snapshot) !== actorSeat) return "ACTOR_MISMATCH";
  if (
    Number.isInteger(sample?.bettingRound) &&
    Number.isInteger(snapshot?.bettingRound) &&
    Number(sample.bettingRound) !== Number(snapshot.bettingRound)
  ) {
    return "BETTING_ROUND_MISMATCH";
  }
  if (invalidReason === "STATE_RESTORE_ERROR") return "STATE_RESTORE_MISMATCH";
  return "UNKNOWN";
}

export function repairReplayActionLegality({
  controller,
  state,
  actorSeat,
  action,
  replayResult,
  sample,
} = {}) {
  const snapshot = clone(state?.snapshot ?? controller?.getUiSnapshot?.(state) ?? {});
  const refreshedLegalActions = controller?.getLegalActions?.(state, actorSeat) ?? [];
  const originalLegalActions = Array.isArray(sample?.legalActions) ? sample.legalActions : [];
  const actionType = normalizeActionType(action);
  const classification = classifyReplayInvalidReason({
    sample,
    action,
    refreshedLegalActions,
    replayResult,
    actorSeat,
    snapshot,
  });
  const raiseCount = toNumber(snapshot?.metadata?.raiseCountThisRound ?? snapshot?.raiseCountThisRound, 0);
  const toCall = Math.max(
    0,
    ...refreshedLegalActions
      .map((legalAction) => toNumber(legalAction?.toCall))
      .filter((value) => Number.isFinite(value)),
  );
  const actorStack = toNumber(snapshot?.players?.[actorSeat]?.stack, 0);
  const baseDetail = {
    invalidReason: classification,
    originalLegalActions,
    refreshedLegalActions,
    actionBeforeReplay: normalizeLegalActionStub(action),
    actionAfterRefresh: normalizeLegalActionStub(action),
    capState: {
      raiseCount,
      maxRaisesThisRound: snapshot?.metadata?.maxRaisesThisRound ?? snapshot?.maxRaisesThisRound ?? null,
      currentBet: snapshot?.currentBet ?? snapshot?.metadata?.currentBet ?? null,
    },
    raiseCount,
    toCall,
    stack: actorStack,
    pot: snapshot?.pot ?? snapshot?.metadata?.pot ?? 0,
    playerCount: Array.isArray(snapshot?.players) ? snapshot.players.length : sample?.playerCount ?? 0,
    position: sample?.position ?? null,
    bettingRound: sample?.bettingRound ?? snapshot?.bettingRound ?? null,
    drawRound: sample?.drawRound ?? snapshot?.drawRound ?? null,
  };

  if (actionType === "RAISE" && hasLegalAction(refreshedLegalActions, "CALL")) {
    return {
      ok: true,
      repairedAction: { type: "CALL", amount: 0, discardIndexes: [] },
      repairType: "RAISE_TO_CALL",
      ...baseDetail,
      actionAfterRefresh: { type: "CALL", amount: 0, discardIndexes: [] },
    };
  }

  if (actionType === "CALL" && !hasLegalAction(refreshedLegalActions, "CALL")) {
    const currentBet = getCurrentBet(snapshot, actorSeat);
    if (currentBet <= 0 && hasLegalAction(refreshedLegalActions, "CHECK")) {
      return {
        ok: true,
        repairedAction: { type: "CHECK", amount: 0, discardIndexes: [] },
        repairType: "CALL_TO_CHECK",
        ...baseDetail,
        actionAfterRefresh: { type: "CHECK", amount: 0, discardIndexes: [] },
      };
    }
  }

  return {
    ok: false,
    repairedAction: null,
    repairType: null,
    ...baseDetail,
  };
}
