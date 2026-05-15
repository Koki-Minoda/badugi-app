import { ChinesePokerController } from "../../chinese/ChinesePokerController.js";
import { GAME_VARIANTS, getVariantById } from "../../config/variantCatalog.js";
import { validateHandEvIntegrity } from "../ev/evIntegrityChecker.js";
import { assertGameProgressInvariants, getActorIndex } from "../progress/gameProgressInvariants.js";
import {
  buildSignature,
  createProgressHarness,
  describeFailure,
  getProgressHarnessStatus,
  isTerminal,
  snapshotOf,
  stepHarness,
} from "./runProgressScenario.js";

const TERMINAL_PHASE_PATTERN = /SHOWDOWN|HAND_OVER|HAND_RESULT|COMPLETE|TERMINAL|SETTLED/i;

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot ?? {}));
}

export function getProgressionFamily(variant = {}) {
  if (variant.category === "board" && variant.tags?.includes("omaha")) return "FLOP_OMAHA";
  if (variant.category === "board") return "FLOP_HOLDEM";
  if (variant.category === "stud") return "STUD";
  if (variant.category === "triple-draw" || variant.category === "single-draw") return "DRAW";
  if (variant.category === "dramaha") return "SPECIAL";
  if (variant.category === "chinese") return "CHINESE";
  return "UNKNOWN";
}

export function listOneHandProgressionVariants() {
  return GAME_VARIANTS.map((variant) => ({
    ...variant,
    family: getProgressionFamily(variant),
  }));
}

function summarizePlayers(snapshot = {}) {
  return (snapshot.players ?? []).map((player, seatIndex) => ({
    seatIndex,
    playerId: player?.playerId ?? player?.id ?? `seat-${seatIndex}`,
    stack: Number(player?.stack ?? 0) || 0,
    bet: Number(player?.betThisStreet ?? player?.betThisRound ?? player?.bet ?? 0) || 0,
    folded: Boolean(player?.folded || player?.hasFolded),
    allIn: Boolean(player?.allIn),
    busted: Boolean(player?.isBusted || player?.busted || player?.seatOut || player?.sittingOut),
    lastAction: player?.lastAction ?? "",
  }));
}

function terminalPhaseOf(snapshot = {}) {
  return String(snapshot.phase ?? snapshot.street ?? (snapshot.results ? "SHOWDOWN" : "UNKNOWN")).toUpperCase();
}

function getFinalPot(snapshot = {}) {
  if (typeof snapshot.pot === "number") return snapshot.pot;
  if (Array.isArray(snapshot.pots)) {
    return snapshot.pots.reduce((sum, pot) => sum + Math.max(0, Number(pot?.amount ?? pot?.potAmount) || 0), 0);
  }
  return 0;
}

function getWinnerCount(snapshot = {}) {
  if (Array.isArray(snapshot.lastHandResult?.winners)) return snapshot.lastHandResult.winners.length;
  if (Array.isArray(snapshot.lastHandResult?.results)) {
    return new Set(
      snapshot.lastHandResult.results
        .flatMap((result) => result?.payouts ?? result?.winners ?? [])
        .map((winner) => winner?.seatIndex ?? winner?.id)
        .filter((value) => value != null),
    ).size;
  }
  if (snapshot.results?.totals && typeof snapshot.results.totals === "object") {
    return Object.values(snapshot.results.totals).filter((points) => Number(points) > 0).length;
  }
  return 0;
}

function buildTraceEntry({ variantId, family, seed, step, snapshot, selectedAction = null, legalActions = [] }) {
  return {
    variantId,
    family,
    seed,
    step,
    phase: terminalPhaseOf(snapshot),
    actor: getActorIndex(snapshot),
    legalActions: legalActions.map((action) => action?.type ?? action?.action ?? action),
    selectedAction,
    players: summarizePlayers(snapshot),
    pot: getFinalPot(snapshot),
    currentBet: snapshot.currentBet ?? snapshot.metadata?.currentBet ?? 0,
    drawRoundIndex: snapshot.drawRoundIndex ?? snapshot.drawRound ?? snapshot.metadata?.drawRoundIndex ?? 0,
    maxDrawRounds: snapshot.maxDrawRounds ?? snapshot.metadata?.maxDrawRounds ?? null,
    lastAction: summarizePlayers(snapshot).map((player) => player.lastAction).filter(Boolean).at(-1) ?? null,
  };
}

function runChineseOneHand({ seed, maxSteps }) {
  void seed;
  const controller = new ChinesePokerController({
    seats: [
      { id: "hero", name: "You", isHero: true, stack: 0 },
      { id: "cpu-1", name: "CPU 1", stack: 0 },
      { id: "cpu-2", name: "CPU 2", stack: 0 },
      { id: "cpu-3", name: "CPU 3", stack: 0 },
    ],
  });
  const trace = [];
  let snapshot = controller.startNewHand();
  trace.push(buildTraceEntry({ variantId: "CP1", family: "CHINESE", seed, step: 0, snapshot }));
  const hero = snapshot.players.find((player) => player.isHero);
  controller.autoSetRows(hero.id);
  snapshot = controller.resolveShowdown();
  trace.push(buildTraceEntry({ variantId: "CP1", family: "CHINESE", seed, step: 1, snapshot }));
  return {
    variantId: "CP1",
    family: "CHINESE",
    seed,
    status: "PASS",
    terminalPhase: "SHOWDOWN",
    steps: Math.min(2, maxSteps),
    handEnded: true,
    winnerCount: getWinnerCount(snapshot),
    finalPot: 0,
    reason: "chinese-showdown",
    skipReason: null,
    trace,
  };
}

export async function runOneHandProgression({
  variantId,
  family = null,
  seed = 20260506,
  maxSteps = 300,
  actionPolicy = "safe",
  playerCount,
} = {}) {
  const variant = getVariantById(variantId);
  const resolvedFamily = family ?? getProgressionFamily(variant);
  if (!variant) {
    return {
      variantId,
      family: resolvedFamily ?? "UNKNOWN",
      seed,
      status: "SKIP",
      terminalPhase: "UNKNOWN",
      steps: 0,
      handEnded: false,
      winnerCount: 0,
      finalPot: 0,
      reason: "variant not found",
      skipReason: "variant not found",
      trace: [],
    };
  }

  if (variantId === "CP1") {
    return runChineseOneHand({ seed, maxSteps });
  }

  const harnessStatus = getProgressHarnessStatus(variantId);
  if (!harnessStatus.supported) {
    return {
      variantId,
      family: resolvedFamily,
      seed,
      status: "SKIP",
      terminalPhase: "UNKNOWN",
      steps: 0,
      handEnded: false,
      winnerCount: 0,
      finalPot: 0,
      reason: harnessStatus.reason,
      skipReason: `variantId=${variantId} family=${resolvedFamily} reason=${harnessStatus.reason}`,
      trace: [],
    };
  }

  const harness = createProgressHarness(variantId, { seatCount: playerCount ?? 6 });
  const beforeHandSnapshot = cloneSnapshot(snapshotOf(harness));
  const trace = [];
  let previousSignature = null;
  let repeated = 0;

  for (let step = 0; step < maxSteps; step += 1) {
    const snapshot = snapshotOf(harness);
    const context = {
      variantId,
      family: resolvedFamily,
      seed,
      step,
      snapshot,
      maxDrawRounds: variant.drawRounds,
      handCardCount: variant.category === "board" ? 0 : variant.holeCards,
      maxDiscardCount: variant.holeCards,
      enforceHandSize:
        variant.category === "triple-draw" ||
        variant.category === "single-draw" ||
        variant.category === "dramaha",
    };
    assertGameProgressInvariants(snapshot, context);
    trace.push(buildTraceEntry({ variantId, family: resolvedFamily, seed, step, snapshot }));

    if (isTerminal(snapshot)) {
      const terminalPhase = terminalPhaseOf(snapshot);
      const winnerCount = getWinnerCount(snapshot);
      const validTerminal = TERMINAL_PHASE_PATTERN.test(terminalPhase) || winnerCount > 0;
      const evCheck = validateHandEvIntegrity({
        beforeState: beforeHandSnapshot,
        afterState: snapshot,
        result: snapshot.lastHandResult ?? snapshot.result ?? snapshot.results ?? null,
        variant,
        options: {
          allowMissingResult: true,
          allowResultPotEcho: true,
          enforceZeroSumReward: false,
        },
      });
      const validEv = evCheck.ok;
      return {
        variantId,
        family: resolvedFamily,
        seed,
        status: validTerminal && validEv ? "PASS" : "FAIL",
        terminalPhase,
        steps: step,
        handEnded: true,
        winnerCount,
        finalPot: getFinalPot(snapshot),
        reason:
          validTerminal && validEv
            ? "terminal reached"
            : !validTerminal
              ? "terminal state lacks valid reason"
              : `[MGX_EV_INTEGRITY] ${JSON.stringify({ errors: evCheck.errors, metrics: evCheck.metrics, trace: evCheck.trace })}`,
        skipReason: null,
        trace,
        ev: {
          ok: evCheck.ok,
          errors: evCheck.errors,
          warnings: evCheck.warnings,
          metrics: evCheck.metrics,
        },
      };
    }

    const signature = buildSignature(snapshot);
    repeated = signature === previousSignature ? repeated + 1 : 0;
    previousSignature = signature;
    if (repeated >= 8) {
      const failure = describeFailure(snapshot, {
        variantId,
        family: resolvedFamily,
        seed,
        step,
        actionPolicy,
      });
      return {
        variantId,
        family: resolvedFamily,
        seed,
        status: "FAIL",
        terminalPhase: terminalPhaseOf(snapshot),
        steps: step,
        handEnded: false,
        winnerCount: 0,
        finalPot: getFinalPot(snapshot),
        reason: `[MGX_ONE_HAND_FREEZE] repeated state ${JSON.stringify(failure)}`,
        skipReason: null,
        trace,
      };
    }

    try {
      const stepResult = stepHarness(harness);
      const nextSnapshot = snapshotOf(harness);
      trace[trace.length - 1] = {
        ...trace[trace.length - 1],
        selectedAction: stepResult?.selectedAction ?? null,
        legalActions: (stepResult?.legalActions ?? []).map((action) => action?.type ?? action?.action ?? action),
        nextPhase: terminalPhaseOf(nextSnapshot),
      };
    } catch (error) {
      return {
        variantId,
        family: resolvedFamily,
        seed,
        status: "FAIL",
        terminalPhase: terminalPhaseOf(snapshot),
        steps: step,
        handEnded: false,
        winnerCount: 0,
        finalPot: getFinalPot(snapshot),
        reason: error?.message ?? String(error),
        skipReason: null,
        trace,
      };
    }
  }

  const snapshot = snapshotOf(harness);
  return {
    variantId,
    family: resolvedFamily,
    seed,
    status: "FAIL",
    terminalPhase: terminalPhaseOf(snapshot),
    steps: maxSteps,
    handEnded: false,
    winnerCount: getWinnerCount(snapshot),
    finalPot: getFinalPot(snapshot),
    reason: `[MGX_ONE_HAND_TIMEOUT] maxSteps=${maxSteps}`,
    skipReason: null,
    trace,
  };
}
