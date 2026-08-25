import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AceToFiveSingleDrawController } from "./AceToFiveSingleDrawController.js";
import { AceToFiveSingleDrawEngine } from "./AceToFiveSingleDrawEngine.js";
import { DeuceToSevenSingleDrawController } from "./DeuceToSevenSingleDrawController.js";
import { DeuceToSevenSingleDrawEngine } from "./DeuceToSevenSingleDrawEngine.js";

const DEFAULT_OUTPUT = "reports/alpha/single-draw-progression-rule-audit.json";

const VARIANTS = [
  {
    variantId: "S01",
    gameId: "deuce_to_seven_single_draw",
    displayName: "2-7 Single Draw",
    Controller: DeuceToSevenSingleDrawController,
    Engine: DeuceToSevenSingleDrawEngine,
  },
  {
    variantId: "S02",
    gameId: "ace_to_five_single_draw",
    displayName: "A-5 Single Draw",
    Controller: AceToFiveSingleDrawController,
    Engine: AceToFiveSingleDrawEngine,
  },
];

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

function makeController(definition, { seatConfig = ["HUMAN", "CPU"], dealerIndex = 0 } = {}) {
  return new definition.Controller({
    engine: new definition.Engine(),
    tableConfig: {
      seatConfig,
      startingStack: 500,
      dealerIndex,
      structure: { sb: 10, bb: 20 },
    },
  });
}

function makeHand(definition, { seatConfig, dealerIndex = 0 } = {}) {
  const controller = makeController(definition, { seatConfig, dealerIndex });
  const state = controller.createNewHandState(controller.createInitialState());
  return { controller, state, snapshot: state.snapshot };
}

function checkPreDrawFirstActor(definition, { label, seatConfig, dealerIndex, expected }) {
  const { snapshot } = makeHand(definition, { seatConfig, dealerIndex });
  const bbSeat = snapshot.metadata?.lastBlinds?.bbIndex;
  const expectedFirstActor =
    typeof expected === "number"
      ? expected
      : typeof bbSeat === "number"
        ? activeSeat(snapshot.players, (bbSeat + 1) % snapshot.players.length)
        : null;
  return {
    id: `${definition.variantId}-${label}`,
    variantId: definition.variantId,
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

function playHuProgression(definition) {
  const controller = makeController(definition, { seatConfig: ["HUMAN", "CPU"], dealerIndex: 0 });
  let state = controller.createNewHandState(controller.createInitialState());
  const phases = [];
  const drawRounds = [];
  const pots = [];
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
  act({ seatIndex: 1, type: "DRAW", discardIndexes: [] });
  act({ seatIndex: 0, type: "DRAW", discardIndexes: [] });
  act({ seatIndex: 1, type: "CHECK" });
  act({ seatIndex: 0, type: "CHECK" });

  return {
    id: `${definition.variantId}-hu-full-progression`,
    variantId: definition.variantId,
    type: "phase-sequence",
    phases,
    drawRounds,
    potMinimum: Math.min(...pots),
    expectedDrawCount: 1,
    observedDrawCount: Math.max(...drawRounds),
    noSecondDraw: !drawRounds.includes(2),
    noThirdDraw: !drawRounds.includes(3),
    terminalReached: controller.isHandFinished(state),
    nextHandClean: (() => {
      const next = controller.createNewHandState(state);
      return next.snapshot.phase === "BET" && next.snapshot.drawRound === 0 && next.snapshot.pot > 0;
    })(),
    matched:
      phases.includes("DRAW") &&
      phases.includes("SHOWDOWN") &&
      Math.max(...drawRounds) === 1 &&
      !drawRounds.includes(2) &&
      !drawRounds.includes(3) &&
      controller.isHandFinished(state),
  };
}

function checkDrawRange(definition) {
  const controller = makeController(definition, { seatConfig: ["HUMAN", "CPU"], dealerIndex: 0 });
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
    id: `${definition.variantId}-draw-range`,
    variantId: definition.variantId,
    type: "draw",
    legalDraw,
    maxDiscard: legalDraw[0]?.maxDiscard ?? null,
    invalidRejected: invalid.events?.[0]?.type === "invalidAction",
    matched: legalDraw[0]?.minDiscard === 0 && legalDraw[0]?.maxDiscard === 5 && invalid.events?.[0]?.type === "invalidAction",
  };
}

function checkEvaluator27() {
  const engine = new DeuceToSevenSingleDrawEngine();
  const wheel = engine.evaluateShowdownHand(["7S", "5D", "4C", "3H", "2S"]);
  const eightLow = engine.evaluateShowdownHand(["8S", "6D", "5C", "3S", "2C"]);
  const aceHand = engine.evaluateShowdownHand(["AS", "7D", "5C", "4H", "2S"]);
  const straight = engine.evaluateShowdownHand(["7S", "6D", "5C", "4H", "3S"]);
  const flush = engine.evaluateShowdownHand(["8S", "6S", "5S", "3S", "2S"]);
  const pair = engine.evaluateShowdownHand(["7S", "7D", "4C", "3H", "2S"]);
  return {
    id: "S01-low-27-evaluator",
    variantId: "S01",
    type: "evaluator",
    bestHand: wheel.handName,
    wheelBeatsEightLow: wheel.rankPrimary < eightLow.rankPrimary,
    aceHigh: aceHand.metadata?.ranks?.[0] === 14,
    straightPenalty: (straight.metadata?.penalty ?? 0) > 0,
    flushPenalty: (flush.metadata?.penalty ?? 0) > 0,
    pairPenalty: (pair.metadata?.penalty ?? 0) > 0,
    matched:
      wheel.rankPrimary < eightLow.rankPrimary &&
      aceHand.metadata?.ranks?.[0] === 14 &&
      (straight.metadata?.penalty ?? 0) > 0 &&
      (flush.metadata?.penalty ?? 0) > 0 &&
      (pair.metadata?.penalty ?? 0) > 0,
  };
}

function checkEvaluatorA5() {
  const engine = new AceToFiveSingleDrawEngine();
  const wheel = engine.evaluateShowdownHand(["AS", "2S", "3S", "4S", "5S"]);
  const sixLow = engine.evaluateShowdownHand(["6S", "4D", "3C", "2H", "AS"]);
  const sevenLow = engine.evaluateShowdownHand(["7S", "5D", "4C", "3H", "2S"]);
  const straight = engine.evaluateShowdownHand(["AS", "2D", "3C", "4H", "5S"]);
  const flush = engine.evaluateShowdownHand(["6S", "4S", "3S", "2S", "AS"]);
  const pair = engine.evaluateShowdownHand(["7S", "7D", "4C", "3H", "2S"]);
  return {
    id: "S02-low-a5-evaluator",
    variantId: "S02",
    type: "evaluator",
    bestHand: wheel.handName,
    wheelBeatsSixLow: wheel.rankPrimary < sixLow.rankPrimary,
    sixLowBeatsSevenLow: sixLow.rankPrimary < sevenLow.rankPrimary,
    aceLow: sixLow.metadata?.ranks?.at(-1) === 1,
    straightIgnored: (straight.metadata?.penalty ?? 0) === 0,
    flushIgnored: (flush.metadata?.penalty ?? 0) === 0,
    pairPenalty: (pair.metadata?.penalty ?? 0) > 0,
    matched:
      wheel.rankPrimary < sixLow.rankPrimary &&
      sixLow.rankPrimary < sevenLow.rankPrimary &&
      sixLow.metadata?.ranks?.at(-1) === 1 &&
      (straight.metadata?.penalty ?? 0) === 0 &&
      (flush.metadata?.penalty ?? 0) === 0 &&
      (pair.metadata?.penalty ?? 0) > 0,
  };
}

export function buildSingleDrawProgressionRuleAudit() {
  const rows = [
    ...VARIANTS.flatMap((definition) => [
      checkPreDrawFirstActor(definition, {
        label: "6max-pre-draw-utg",
        seatConfig: ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"],
        dealerIndex: 0,
      }),
      checkPreDrawFirstActor(definition, {
        label: "3way-pre-draw-utg",
        seatConfig: ["HUMAN", "CPU", "CPU"],
        dealerIndex: 0,
      }),
      checkPreDrawFirstActor(definition, {
        label: "hu-pre-draw-button-small-blind",
        seatConfig: ["HUMAN", "CPU"],
        dealerIndex: 0,
        expected: 0,
      }),
      playHuProgression(definition),
      checkDrawRange(definition),
    ]),
    checkEvaluator27(),
    checkEvaluatorA5(),
  ];
  const failed = rows.filter((row) => !row.matched);
  return {
    generatedAt: new Date().toISOString(),
    variants: VARIANTS.map(({ variantId, gameId, displayName }) => ({ variantId, gameId, displayName })),
    status: failed.length ? "FAIL" : "PASS_FOCUSED_AUDIT",
    summary: {
      total: rows.length,
      passed: rows.length - failed.length,
      failed: failed.length,
    },
    rows,
  };
}

export function writeSingleDrawProgressionRuleAudit(outputPath = DEFAULT_OUTPUT) {
  const report = buildSingleDrawProgressionRuleAudit();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  const report = writeSingleDrawProgressionRuleAudit(process.argv[2] ?? DEFAULT_OUTPUT);
  console.log(JSON.stringify({ status: report.status, summary: report.summary }, null, 2));
}
