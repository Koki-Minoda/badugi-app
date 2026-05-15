import { validateHandEvIntegrity } from "../../games/testing/ev/evIntegrityChecker.js";
import {
  buildActionPayload,
  clone,
  createControllerForVariant,
  decideAction,
  getCurrentBet,
  isEvaluationTerminal,
  normalizeActionType,
} from "./runAiEvaluationBatch.js";
import {
  createActionHash,
  createReplayStateHash,
  createReplayTraceHash,
} from "./replayDeterminismHash.js";

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function createSeededRandom(seed = 1) {
  let value = Math.max(1, Math.floor(seed) % 2147483647);
  return () => {
    value = (value * 48271) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

async function withSeededRandom(seed, callback) {
  const previousRandom = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return await callback();
  } finally {
    Math.random = previousRandom;
  }
}

function hasLegalAction(legalActions = [], target) {
  const wanted = String(target ?? "").toUpperCase();
  return legalActions.some((action) => String(action?.type ?? action).toUpperCase() === wanted);
}

export function getActorIndex(snapshot = {}) {
  const candidates = [
    snapshot?.currentActor,
    snapshot?.actingPlayerIndex,
    snapshot?.nextTurn,
    snapshot?.turn,
  ];
  const actor = candidates.find((value) => Number.isInteger(value));
  return Number.isInteger(actor) ? actor : null;
}

function countWinners(snapshot = {}) {
  if (Array.isArray(snapshot?.lastHandResult?.winners)) {
    return snapshot.lastHandResult.winners
      .map((winner) => Number(winner?.seatIndex ?? winner?.seat))
      .filter(Number.isInteger);
  }
  return [];
}

function getFinalPot(snapshot = {}) {
  if (typeof snapshot?.pot === "number") return snapshot.pot;
  if (Array.isArray(snapshot?.pots)) {
    return snapshot.pots.reduce((sum, pot) => sum + Math.max(0, toNumber(pot?.amount ?? pot?.potAmount)), 0);
  }
  return 0;
}

function applyForcedAction({ controller, state, actorSeat, action, rolloutPolicy }) {
  const snapshot = state?.snapshot ?? controller.getUiSnapshot(state);
  const payload = buildActionPayload({
    seatIndex: actorSeat,
    decision: action,
    tierId: rolloutPolicy,
    currentBetAmount: getCurrentBet(snapshot, actorSeat),
  });
  return controller.applyAction(state, payload);
}

export function isReplayActionStillLegal({ controller, state, actorSeat, action } = {}) {
  const snapshot = state?.snapshot ?? controller?.getUiSnapshot?.(state) ?? {};
  const restoredLegalActions = controller?.getLegalActions?.(state, actorSeat) ?? [];
  const normalizedActionType = normalizeActionType(action);
  const currentBetAmount = getCurrentBet(snapshot, actorSeat);
  const actorStack = toNumber(snapshot?.players?.[actorSeat]?.stack, 0);
  const toCall = Math.max(
    0,
    ...restoredLegalActions
      .map((legalAction) => toNumber(legalAction?.toCall))
      .filter((value) => Number.isFinite(value)),
  );
  const amount = toNumber(action?.amount ?? action?.betAmount);
  let reason = null;
  if (!hasLegalAction(restoredLegalActions, normalizedActionType)) {
    reason = "LEGAL_ACTION_MISMATCH";
  } else if (normalizedActionType === "RAISE" && actorStack <= currentBetAmount + toCall) {
    reason = "STACK_INSUFFICIENT";
  } else if (normalizedActionType === "RAISE" && amount > 0 && actorStack < amount) {
    reason = "STACK_INSUFFICIENT";
  }
  return {
    ok: reason === null,
    reason,
    restoredLegalActions,
    currentBetAmount,
    actorStack,
    toCall,
  };
}

function classifyReplayError(error = "", context = {}) {
  const normalized = String(error ?? "").toLowerCase();
  if (!normalized.length) return "UNKNOWN";
  if (normalized.includes("illegal-replay-action") || normalized.includes("forced-action-rejected")) {
    return "INVALID_ACTION";
  }
  if (normalized.includes("illegal-rollout-action")) return "LEGAL_ACTION_MISMATCH";
  if (normalized.includes("raise cap reached")) return "LEGAL_ACTION_MISMATCH";
  if (normalized.includes("unsupported-variant") || normalized.includes("invalid-sample")) {
    return "STATE_RESTORE_ERROR";
  }
  if (normalized.includes("missing-actor")) return "STATE_RESTORE_ERROR";
  if (normalized.includes("max-steps-exceeded")) return "MAX_STEPS_EXCEEDED";
  if (normalized.includes("ev-check-failed")) return "EV_CHECK_FAILED";
  if (context.terminal === false && normalized.includes("terminal")) return "TERMINAL_MISMATCH";
  return "UNKNOWN";
}

export async function replayDivergenceAction({
  sample,
  action,
  rolloutPolicy = "pro",
  rolloutHands = 1,
  rolloutSeeds = [1, 2, 3],
  maxSteps = 300,
} = {}) {
  const normalizedActionType = normalizeActionType(action);
  const actionHash = createActionHash(action);
  if (!sample?.variantId || !sample?.state || !Number.isInteger(sample?.actorSeat)) {
    return {
      ok: false,
      variantId: sample?.variantId ?? null,
      originalAction: sample?.proAction ?? null,
      replayAction: action ?? null,
      terminal: false,
      seatDelta: null,
      ev: null,
      safety: { illegal: true, freeze: false, evFail: false },
      trace: [],
      errors: ["invalid-sample"],
      invalidReason: "STATE_RESTORE_ERROR",
      actionHash,
    };
  }
  if (!hasLegalAction(sample.legalActions ?? [], normalizedActionType)) {
    return {
      ok: false,
      variantId: sample.variantId,
      originalAction: sample.proAction ?? null,
      replayAction: action ?? null,
      terminal: false,
      seatDelta: null,
      ev: null,
      safety: { illegal: true, freeze: false, evFail: false },
      trace: [],
      errors: ["illegal-replay-action"],
      invalidReason: "INVALID_ACTION",
      actionHash,
    };
  }

  const seatDeltas = [];
  const traces = [];
  const errors = [];
  let illegal = false;
  let freeze = false;
  let evFail = false;
  const invalidDetails = [];

  for (const rolloutSeed of rolloutSeeds.slice(0, Math.max(1, rolloutHands * rolloutSeeds.length))) {
    const replay = await withSeededRandom((sample.seed ?? 1) + rolloutSeed, async () => {
      const controller = createControllerForVariant(
        sample.variantId,
        Array.isArray(sample.state?.snapshot?.players) ? sample.state.snapshot.players.length : 6,
      );
      if (!controller) {
        return { ok: false, error: "unsupported-variant" };
      }
      let state = clone(sample.state);
      const beforeSnapshot = clone(state?.snapshot ?? controller.getUiSnapshot(state));
      const initialStateHash = createReplayStateHash(state);
      const trace = [];
      const legality = isReplayActionStillLegal({
        controller,
        state,
        actorSeat: sample.actorSeat,
        action,
      });
      if (!legality.ok) {
        return {
          ok: false,
          error: legality.reason?.toLowerCase() ?? "replay-action-no-longer-legal",
          invalidReason: legality.reason ?? "LEGAL_ACTION_MISMATCH",
          initialStateHash,
          actionHash,
          restoredLegalActions: legality.restoredLegalActions,
          currentBetAmount: legality.currentBetAmount,
          actorStack: legality.actorStack,
          toCall: legality.toCall,
          legalityValidated: false,
        };
      }
      const forcedResult = applyForcedAction({
        controller,
        state,
        actorSeat: sample.actorSeat,
        action,
        rolloutPolicy,
      });
      const invalidEvent = forcedResult?.events?.find((event) =>
        ["invalidAction", "error"].includes(String(event?.type ?? "")),
      );
      if (invalidEvent) {
        const error = invalidEvent?.error ?? invalidEvent?.message ?? "forced-action-rejected";
        return {
          ok: false,
          error,
          invalidReason: classifyReplayError(error),
          initialStateHash,
          actionHash,
          restoredLegalActions: legality.restoredLegalActions,
          currentBetAmount: legality.currentBetAmount,
          actorStack: legality.actorStack,
          toCall: legality.toCall,
          legalityValidated: false,
        };
      }
      state = forcedResult.state;
      for (let step = 0; step < maxSteps; step += 1) {
        const snapshot = state?.snapshot ?? controller.getUiSnapshot(state);
        if (isEvaluationTerminal(controller, state, snapshot)) {
          const afterSnapshot = clone(snapshot);
          const seatDelta =
            toNumber(afterSnapshot?.players?.[sample.actorSeat]?.stack, 0) -
            toNumber(beforeSnapshot?.players?.[sample.actorSeat]?.stack, 0);
          const evCheck = validateHandEvIntegrity({
            beforeState: beforeSnapshot,
            afterState: afterSnapshot,
            result: afterSnapshot.lastHandResult ?? afterSnapshot.result ?? afterSnapshot.results ?? null,
            variant: { id: sample.variantId },
            options: {
              allowMissingResult: true,
              allowResultPotEcho: true,
              enforceZeroSumReward: false,
            },
          });
          return {
            ok: true,
            terminal: true,
            seatDelta,
            ev: seatDelta,
            trace,
            initialStateHash,
            terminalStateHash: createReplayStateHash(state),
            actionHash,
            traceHash: createReplayTraceHash(trace),
            legalityValidated: true,
            safety: {
              illegal: false,
              freeze: false,
              evFail: !evCheck.ok,
            },
            showdownResult: countWinners(afterSnapshot).includes(sample.actorSeat)
              ? "win"
              : seatDelta > 0
                ? "profit"
                : seatDelta < 0
                  ? "loss"
                  : "neutral",
            finalPot: getFinalPot(afterSnapshot),
          };
        }
        const actor = getActorIndex(snapshot);
        if (!Number.isInteger(actor)) {
          return { ok: false, error: "missing-actor", trace };
        }
        const decision = decideAction({
          controller,
          variantId: sample.variantId,
          state,
          seatIndex: actor,
          tierId: rolloutPolicy,
        });
        const actionType = normalizeActionType(decision);
        const legalActions = controller.getLegalActions(state, actor);
        if (!hasLegalAction(legalActions, actionType)) {
          const error = "illegal-rollout-action";
          return {
            ok: false,
            error,
            trace,
            invalidReason: classifyReplayError(error),
            initialStateHash,
            terminalStateHash: createReplayStateHash(state),
            actionHash,
            traceHash: createReplayTraceHash(trace),
            restoredLegalActions: controller.getLegalActions(state, actor),
            legalityValidated: true,
          };
        }
        trace.push({
          step,
          actor,
          actionType,
          stateHash: createReplayStateHash(state),
        });
        const result = controller.applyAction(
          state,
          buildActionPayload({
            seatIndex: actor,
            decision,
            tierId: rolloutPolicy,
            currentBetAmount: getCurrentBet(snapshot, actor),
          }),
        );
        const rolloutInvalid = result?.events?.find((event) =>
          ["invalidAction", "error"].includes(String(event?.type ?? "")),
        );
        if (rolloutInvalid) {
          const error = rolloutInvalid?.error ?? rolloutInvalid?.message ?? "rollout-rejected";
          return {
            ok: false,
            error,
            trace,
            invalidReason: classifyReplayError(error),
            initialStateHash,
            terminalStateHash: createReplayStateHash(state),
            actionHash,
            traceHash: createReplayTraceHash(trace),
            legalityValidated: true,
          };
        }
        state = result.state;
      }
      const error = "max-steps-exceeded";
      return {
        ok: false,
        error,
        trace,
        freeze: true,
        invalidReason: classifyReplayError(error),
        initialStateHash,
        terminalStateHash: createReplayStateHash(state),
        actionHash,
        traceHash: createReplayTraceHash(trace),
      };
    });

    if (!replay.ok) {
      errors.push(replay.error ?? "invalid-replay");
      invalidDetails.push({
        rolloutSeed,
        error: replay.error ?? "invalid-replay",
        invalidReason: replay.invalidReason ?? classifyReplayError(replay.error),
        initialStateHash: replay.initialStateHash ?? null,
        terminalStateHash: replay.terminalStateHash ?? null,
        actionHash: replay.actionHash ?? actionHash,
        traceHash: replay.traceHash ?? null,
        legalityValidated: Boolean(replay.legalityValidated),
        restoredLegalActions: replay.restoredLegalActions ?? [],
        currentBetAmount: replay.currentBetAmount ?? null,
        actorStack: replay.actorStack ?? null,
        toCall: replay.toCall ?? null,
        legalActions: sample.legalActions ?? [],
      });
      illegal = illegal || replay.error?.includes("illegal");
      freeze = freeze || Boolean(replay.freeze);
      continue;
    }
    seatDeltas.push(replay.seatDelta);
    traces.push(replay.trace);
      evFail = evFail || Boolean(replay.safety?.evFail);
  }

  if (!seatDeltas.length) {
    const invalidReason = invalidDetails[0]?.invalidReason ?? classifyReplayError(errors[0]);
    return {
      ok: false,
      variantId: sample.variantId,
      originalAction: sample.proAction ?? null,
      replayAction: action,
      terminal: false,
      seatDelta: null,
      ev: null,
      safety: { illegal, freeze, evFail },
      trace: traces,
      errors,
      invalidReason,
      invalidDetails,
      actionHash,
      legalityValidated: false,
    };
  }

  const avgSeatDelta = seatDeltas.reduce((sum, value) => sum + value, 0) / seatDeltas.length;
  return {
    ok: true,
    variantId: sample.variantId,
    originalAction: sample.proAction ?? null,
    replayAction: action,
    terminal: true,
    seatDelta: avgSeatDelta,
    ev: avgSeatDelta,
    safety: { illegal, freeze, evFail },
    trace: traces,
    errors,
    initialStateHash: invalidDetails[0]?.initialStateHash ?? null,
    terminalStateHash: null,
    actionHash,
    traceHash: traces.length ? createReplayTraceHash(traces[0]) : null,
    legalityValidated: true,
  };
}
