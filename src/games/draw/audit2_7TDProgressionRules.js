import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DeuceToSevenTripleDrawController } from "./DeuceToSevenTripleDrawController.js";
import { DeuceToSevenTripleDrawEngine } from "./DeuceToSevenTripleDrawEngine.js";

const DEFAULT_OUTPUT = "reports/alpha/2-7td-progression-rule-audit.json";

function activeSeat(players = [], startIndex = 0, { includeAllIn = false } = {}) {
  if (!players.length) return null;
  for (let offset = 0; offset < players.length; offset += 1) {
    const seatIndex = (startIndex + offset) % players.length;
    const player = players[seatIndex];
    if (!player || player.folded || player.sittingOut || player.seatOut || player.isBusted) continue;
    if (!includeAllIn && player.allIn) continue;
    return seatIndex;
  }
  return null;
}

function makeController({ seatConfig = ["HUMAN", "CPU"], dealerIndex = 0 } = {}) {
  return new DeuceToSevenTripleDrawController({
    engine: new DeuceToSevenTripleDrawEngine(),
    tableConfig: {
      seatConfig,
      startingStack: 500,
      dealerIndex,
      structure: { sb: 10, bb: 20 },
    },
  });
}

function makeHand({ seatConfig, dealerIndex = 0 } = {}) {
  const controller = makeController({ seatConfig, dealerIndex });
  const state = controller.createNewHandState(controller.createInitialState());
  return { controller, state, snapshot: state.snapshot };
}

function checkPreDrawFirstActor({ label, seatConfig, dealerIndex, expected }) {
  const { snapshot } = makeHand({ seatConfig, dealerIndex });
  const bbSeat = snapshot.metadata?.lastBlinds?.bbIndex;
  const expectedFirstActor =
    typeof expected === "number"
      ? expected
      : typeof bbSeat === "number"
        ? activeSeat(snapshot.players, (bbSeat + 1) % snapshot.players.length)
        : null;
  return {
    id: label,
    type: "first-actor",
    playerCount: snapshot.players.filter((player) => !player.seatOut && !player.sittingOut).length,
    phase: snapshot.phase,
    drawRound: snapshot.drawRound,
    buttonSeat: snapshot.dealerIndex,
    sbSeat: snapshot.metadata?.lastBlinds?.sbIndex ?? null,
    bbSeat: bbSeat ?? null,
    expectedFirstActor,
    actualFirstActor: snapshot.turn,
    matched: snapshot.turn === expectedFirstActor,
  };
}

function playHuProgression() {
  const { controller } = makeHand({
    seatConfig: ["HUMAN", "CPU"],
    dealerIndex: 0,
  });
  let state = controller.createNewHandState(controller.createInitialState());
  const phases = [];
  const drawRounds = [];
  const pots = [];
  let terminalReached = false;

  const record = () => {
    phases.push(state.snapshot.phase);
    drawRounds.push(state.snapshot.drawRound);
    pots.push(state.snapshot.pot);
  };
  const act = (action) => {
    const result = controller.applyAction(state, action);
    state = result.state;
    record();
  };

  record();
  act({ seatIndex: 0, type: "CALL" });
  act({ seatIndex: 1, type: "CHECK" });

  for (let drawRound = 1; drawRound <= 3; drawRound += 1) {
    act({ seatIndex: 1, type: "DRAW", discardIndexes: [] });
    act({ seatIndex: 0, type: "DRAW", discardIndexes: [] });
    act({ seatIndex: 1, type: "CHECK" });
    act({ seatIndex: 0, type: "CHECK" });
  }

  terminalReached = controller.isHandFinished(state);
  return {
    id: "hu-full-progression",
    type: "phase-sequence",
    phases,
    drawRounds,
    potMinimum: Math.min(...pots),
    expectedDrawCount: 3,
    observedDrawCount: Math.max(...drawRounds),
    terminalReached,
    nextHandClean: (() => {
      const next = controller.createNewHandState(state);
      return next.snapshot.phase === "BET" && next.snapshot.drawRound === 0 && next.snapshot.pot > 0;
    })(),
    matched:
      phases.includes("DRAW") &&
      phases.includes("SHOWDOWN") &&
      Math.max(...drawRounds) === 3 &&
      terminalReached,
  };
}

function checkEvaluator() {
  const engine = new DeuceToSevenTripleDrawEngine();
  const best = engine.evaluateShowdownHand(["7S", "5D", "4C", "3H", "2S"]);
  const eightLow = engine.evaluateShowdownHand(["8S", "6D", "4C", "3H", "2S"]);
  const aceLowShape = engine.evaluateShowdownHand(["6S", "5D", "4C", "3H", "AS"]);
  const straight = engine.evaluateShowdownHand(["7S", "6D", "5C", "4H", "3S"]);
  const flush = engine.evaluateShowdownHand(["7S", "5S", "4S", "3S", "2S"]);
  const pair = engine.evaluateShowdownHand(["7S", "7D", "4C", "3H", "2S"]);
  return {
    id: "low-27-evaluator",
    type: "evaluator",
    bestHand: best.handName,
    bestBeatsEightLow: best.rankPrimary < eightLow.rankPrimary,
    aceHigh: aceLowShape.metadata?.ranks?.[0] === 14,
    straightPenalty: (straight.metadata?.penalty ?? 0) > 0,
    flushPenalty: (flush.metadata?.penalty ?? 0) > 0,
    pairPenalty: (pair.metadata?.penalty ?? 0) > 0,
    matched:
      best.rankPrimary < eightLow.rankPrimary &&
      aceLowShape.metadata?.ranks?.[0] === 14 &&
      (straight.metadata?.penalty ?? 0) > 0 &&
      (flush.metadata?.penalty ?? 0) > 0 &&
      (pair.metadata?.penalty ?? 0) > 0,
  };
}

function checkDrawRange() {
  const { controller } = makeHand({ seatConfig: ["HUMAN", "CPU"], dealerIndex: 0 });
  let state = controller.createNewHandState(controller.createInitialState());
  state = controller.applyAction(state, { seatIndex: 0, type: "CALL" }).state;
  state = controller.applyAction(state, { seatIndex: 1, type: "CHECK" }).state;
  const legalDraw = controller.getLegalActions(state, state.snapshot.turn);
  const invalid = controller.applyAction(state, {
    seatIndex: state.snapshot.turn,
    type: "DRAW",
    discardIndexes: [0, 1, 2, 3, 4, 5],
  });
  return {
    id: "draw-range",
    type: "draw",
    legalDraw,
    maxDiscard: legalDraw[0]?.maxDiscard ?? null,
    invalidRejected: invalid.events?.[0]?.type === "invalidAction",
    matched: legalDraw[0]?.minDiscard === 0 && legalDraw[0]?.maxDiscard === 5 && invalid.events?.[0]?.type === "invalidAction",
  };
}

export function build2_7TDProgressionRuleAudit() {
  const rows = [
    checkPreDrawFirstActor({
      label: "6max-pre-draw-utg",
      seatConfig: ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"],
      dealerIndex: 0,
    }),
    checkPreDrawFirstActor({
      label: "3way-pre-draw-utg",
      seatConfig: ["HUMAN", "CPU", "CPU"],
      dealerIndex: 0,
    }),
    checkPreDrawFirstActor({
      label: "hu-pre-draw-button-small-blind",
      seatConfig: ["HUMAN", "CPU"],
      dealerIndex: 0,
      expected: 0,
    }),
    playHuProgression(),
    checkDrawRange(),
    checkEvaluator(),
  ];
  const failed = rows.filter((row) => !row.matched);
  return {
    generatedAt: new Date().toISOString(),
    variantId: "D01",
    gameId: "deuce_to_seven_triple_draw",
    displayName: "2-7 Triple Draw",
    status: failed.length ? "FAIL" : "PASS_FOCUSED_AUDIT",
    summary: {
      total: rows.length,
      passed: rows.length - failed.length,
      failed: failed.length,
    },
    rows,
  };
}

export function write2_7TDProgressionRuleAudit(outputPath = DEFAULT_OUTPUT) {
  const report = build2_7TDProgressionRuleAudit();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  const report = write2_7TDProgressionRuleAudit(process.argv[2] ?? DEFAULT_OUTPUT);
  console.log(JSON.stringify({ status: report.status, summary: report.summary }, null, 2));
}

