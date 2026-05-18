#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DeuceToSevenTripleDrawController } from "../src/games/draw/DeuceToSevenTripleDrawController.js";
import { AceToFiveTripleDrawController } from "../src/games/draw/AceToFiveTripleDrawController.js";
import { DeuceToSevenSingleDrawController } from "../src/games/draw/DeuceToSevenSingleDrawController.js";
import { AceToFiveSingleDrawController } from "../src/games/draw/AceToFiveSingleDrawController.js";
import {
  buildCpuDecisionTraceRow,
  classifyDecisionSource,
  createCpuDecisionTrace,
  normalizeCpuActionType,
} from "../src/ai/qa/cpuDecisionTrace.js";

const VARIANT_CONTROLLERS = {
  D01: DeuceToSevenTripleDrawController,
  D02: AceToFiveTripleDrawController,
  S01: DeuceToSevenSingleDrawController,
  S02: AceToFiveSingleDrawController,
};

function parseArgs(argv) {
  const options = {
    variants: "badugi,D01,D02,S01,S02",
    hands: 100,
    seats: 6,
    mode: "cash",
    cpu: "heuristic",
    outDir: "reports/ai",
  };
  for (const arg of argv.slice(2)) {
    const [rawKey, rawValue = "true"] = arg.replace(/^--/, "").split("=");
    if (rawKey in options) {
      options[rawKey] = rawKey === "hands" || rawKey === "seats" ? Number(rawValue) : rawValue;
    }
  }
  options.variantList = String(options.variants)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return options;
}

function getSnapshot(controller, state) {
  return controller.getUiSnapshot(state);
}

function getEngineState(state) {
  return state?.engineState ?? state?.snapshot ?? state ?? {};
}

function getPhase(snapshot) {
  return snapshot?.phase ?? snapshot?.street ?? "UNKNOWN";
}

function getActor(snapshot) {
  const actor =
    snapshot?.actingPlayerIndex ??
    snapshot?.nextTurn ??
    snapshot?.turn ??
    snapshot?.metadata?.actingPlayerIndex ??
    null;
  return typeof actor === "number" ? actor : null;
}

function getCurrentBet(snapshot) {
  if (typeof snapshot?.currentBet === "number") return snapshot.currentBet;
  return Math.max(
    0,
    ...(snapshot?.players ?? []).map((player) => Number(player?.bet ?? player?.betThisRound ?? 0) || 0),
  );
}

function getPlayerBet(player) {
  return Number(player?.bet ?? player?.betThisRound ?? 0) || 0;
}

function getPot(snapshot) {
  if (typeof snapshot?.pot === "number") return snapshot.pot;
  return (snapshot?.players ?? []).reduce(
    (sum, player) => sum + Math.max(0, Number(player?.totalInvested ?? player?.bet ?? 0) || 0),
    0,
  );
}

function isTerminal(snapshot) {
  const phase = getPhase(snapshot);
  return Boolean(snapshot?.lastHandResult || phase === "SHOWDOWN" || phase === "RESULT");
}

function createController(variantId, seats) {
  const Controller = VARIANT_CONTROLLERS[variantId];
  if (!Controller) throw new Error(`Unknown Core5 variant: ${variantId}`);
  const seatConfig = Array.from({ length: seats }, () => "CPU");
  const tableConfig = { seatConfig, startingStack: 600, dealerIndex: 0 };
  return new Controller({ tableConfig });
}

function createInitialHand(controller, variantId, seats) {
  const seatConfig = Array.from({ length: seats }, () => "CPU");
  let state = controller.createInitialState({ seatConfig, startingStack: 600, dealerIndex: 0 });
  state = controller.createNewHandState(state, {
    seatConfig,
    startingStack: 600,
    dealerIndex: 0,
    handId: `${variantId}-cpu-1`,
  });
  return state;
}

function createNextHand(controller, state, variantId, handNumber, seats) {
  const seatConfig = Array.from({ length: seats }, () => "CPU");
  const snapshot = getSnapshot(controller, state);
  const currentPlayers = (snapshot?.players ?? []).map((player) => ({
    ...player,
    folded: false,
    hasDrawn: false,
    selected: [],
  }));
  return controller.createNewHandState(state, {
    seatConfig,
    currentPlayers,
    dealerIndex: handNumber % seats,
    handId: `${variantId}-cpu-${handNumber}`,
  });
}

function normalizeActionForController(variantId, action, snapshot) {
  const type = normalizeCpuActionType(action?.type);
  const payloadType =
    type === "raise"
      ? getCurrentBet(snapshot) > 0
        ? "RAISE"
        : "BET"
      : type === "draw"
      ? "DRAW"
      : type.toUpperCase();
  const payload = {
    ...action,
    type: payloadType,
    drawIndexes: action?.discardIndexes,
  };
  if (variantId === "badugi") {
    payload.type = payloadType.toLowerCase();
  }
  return {
    seatIndex: action.seatIndex,
    type: payloadType,
    discardIndexes: action?.discardIndexes,
    payload,
  };
}

function getCpuActionForVariant(controller, variantId, state, seatIndex, cpuMode, snapshot, legalActions) {
  if (typeof controller.getCpuAction === "function") {
    const action = controller.getCpuAction(state, seatIndex, {
      tierConfig: cpuMode === "rl" ? { id: "pro" } : { id: "standard" },
    });
    if (action) return action;
  }
  return null;
}

function simulateVariant({ variantId, hands, seats, mode, cpuMode, trace }) {
  const controller = createController(variantId, seats);
  let state = createInitialHand(controller, variantId, seats);
  let handsCompleted = 0;
  let actionCount = 0;
  let showdowns = 0;
  let invalidActions = 0;
  let freezes = 0;
  const maxActionsPerHand = 300;
  const maxTotalActions = hands * maxActionsPerHand;

  while (handsCompleted < hands && actionCount < maxTotalActions) {
    const snapshot = getSnapshot(controller, state);
    if (isTerminal(snapshot)) {
      handsCompleted += 1;
      showdowns += 1;
      if (handsCompleted >= hands) break;
      state = createNextHand(controller, state, variantId, handsCompleted + 1, seats);
      continue;
    }

    const actor = getActor(snapshot);
    if (actor == null) {
      freezes += 1;
      break;
    }
    const player = snapshot?.players?.[actor] ?? {};
    const legalActions = controller.getLegalActions(state, actor);
    const cpuAction = getCpuActionForVariant(
      controller,
      variantId,
      state,
      actor,
      cpuMode,
      snapshot,
      legalActions,
    );
    if (!cpuAction?.type) {
      freezes += 1;
      break;
    }

    const currentBet = getCurrentBet(snapshot);
    const toCall = Math.max(0, currentBet - getPlayerBet(player));
    const metadata = cpuAction.metadata ?? {};
    const requestedRl = cpuMode === "rl";
    const rowBase = buildCpuDecisionTraceRow({
      handId: snapshot?.handId ?? snapshot?.metadata?.handId ?? `${variantId}-cpu-${handsCompleted + 1}`,
      variantId,
      mode,
      seat: actor,
      position: player?.position ?? player?.role ?? null,
      phase: getPhase(snapshot),
      drawRound: snapshot?.drawRound ?? snapshot?.drawRoundIndex ?? 0,
      betRound: snapshot?.betRound ?? snapshot?.betRoundIndex ?? snapshot?.drawRound ?? 0,
      legalActions: legalActions.map((action) => action?.type ?? action),
      selectedAction: cpuAction.type,
      finalAction: cpuAction.type,
      decisionSource: classifyDecisionSource(metadata, requestedRl ? "pro" : "standard"),
      fallbackReason: metadata?.fallbackReason ?? null,
      metadata,
      toCall,
      currentBet,
      pot: getPot(snapshot),
      stack: player?.stack ?? 0,
      positionContext: `${player?.position ?? "unknown"} seat ${actor}`,
      rlRequestSent: requestedRl,
      rlResponseValid: requestedRl && Boolean(metadata?.decisionSource || metadata?.strategy?.startsWith("pro")),
    });

    const controllerAction = normalizeActionForController(variantId, cpuAction, snapshot);
    const outcome = controller.applyAction(state, controllerAction);
    const rejected = (outcome?.events ?? []).some(
      (event) => event?.type === "invalidAction" || event?.type === "error",
    );
    if (rejected) invalidActions += 1;
    trace.record({
      ...rowBase,
      applySuccess: !rejected,
      illegalActionRejected: rejected,
    });
    state = outcome?.state ?? state;
    actionCount += 1;
  }

  return {
    variantId,
    mode,
    cpuMode,
    handsRequested: hands,
    handsCompleted,
    actions: actionCount,
    showdowns,
    invalidActions,
    freezes,
  };
}

export function runCore5CpuVsCpuSanity(options) {
  const originalLog = console.log;
  console.log = (...args) => {
    if (String(args[0] ?? "").startsWith("[DECK]")) return;
    originalLog(...args);
  };
  const trace = createCpuDecisionTrace();
  try {
    const variants = options.variantList ?? [];
    const results = variants.map((variantId) => {
      if (variantId === "badugi") {
        return {
          variantId,
          mode: options.mode,
          cpuMode: options.cpu,
          handsRequested: options.hands,
          handsCompleted: 0,
          actions: 0,
          showdowns: 0,
          invalidActions: 0,
          freezes: 0,
          skipped: true,
          skipReason:
            "Badugi browser/controller simulation is covered by Playwright; the Node sanity runner avoids importing JSX-only UI round-flow modules.",
        };
      }
      return simulateVariant({
        variantId,
        hands: options.hands,
        seats: options.seats,
        mode: options.mode,
        cpuMode: options.cpu,
        trace,
      });
    });
    const summary = {
      generatedAt: new Date().toISOString(),
      options: {
        variants,
        hands: options.hands,
        seats: options.seats,
        mode: options.mode,
        cpu: options.cpu,
      },
      results,
      decisionSummary: trace.summarize(),
    };
    return { trace, summary };
  } finally {
    console.log = originalLog;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv);
  const { trace, summary } = runCore5CpuVsCpuSanity(options);
  fs.mkdirSync(options.outDir, { recursive: true });
  const tracePath = path.join(options.outDir, "cpu-decision-trace.jsonl");
  const summaryPath = path.join(options.outDir, "core5-cpu-vs-cpu-sanity.json");
  trace.writeJsonl(tracePath);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}
