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

function getActorIndex(snapshot = {}) {
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

export async function replayDivergenceAction({
  sample,
  action,
  rolloutPolicy = "pro",
  rolloutHands = 1,
  rolloutSeeds = [1, 2, 3],
  maxSteps = 300,
} = {}) {
  const normalizedActionType = normalizeActionType(action);
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
    };
  }

  const seatDeltas = [];
  const traces = [];
  const errors = [];
  let illegal = false;
  let freeze = false;
  let evFail = false;

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
      const trace = [];
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
        return { ok: false, error: invalidEvent?.error ?? invalidEvent?.message ?? "forced-action-rejected" };
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
          return { ok: false, error: "illegal-rollout-action", trace };
        }
        trace.push({
          step,
          actor,
          actionType,
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
          return { ok: false, error: rolloutInvalid?.error ?? rolloutInvalid?.message ?? "rollout-rejected", trace };
        }
        state = result.state;
      }
      return { ok: false, error: "max-steps-exceeded", trace, freeze: true };
    });

    if (!replay.ok) {
      errors.push(replay.error ?? "invalid-replay");
      illegal = illegal || replay.error?.includes("illegal");
      freeze = freeze || Boolean(replay.freeze);
      continue;
    }
    seatDeltas.push(replay.seatDelta);
    traces.push(replay.trace);
    evFail = evFail || Boolean(replay.safety?.evFail);
  }

  if (!seatDeltas.length) {
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
  };
}
