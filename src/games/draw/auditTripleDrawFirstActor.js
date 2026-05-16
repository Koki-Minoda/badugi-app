import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AceToFiveSingleDrawController } from "./AceToFiveSingleDrawController.js";
import { AceToFiveTripleDrawController } from "./AceToFiveTripleDrawController.js";
import { DeuceToSevenSingleDrawController } from "./DeuceToSevenSingleDrawController.js";
import { DeuceToSevenTripleDrawController } from "./DeuceToSevenTripleDrawController.js";

const DEFAULT_REPORT_PATH = "reports/alpha/triple-draw-first-actor-audit.json";
const STRUCTURE = Object.freeze({ sb: 10, bb: 20, ante: 0 });

const VARIANTS = Object.freeze([
  {
    variantId: "D01",
    displayName: "2-7 Triple Draw",
    Controller: DeuceToSevenTripleDrawController,
    drawCount: 3,
    lowballRule: "2-7",
    alphaStatus: "preview_only",
  },
  {
    variantId: "D02",
    displayName: "A-5 Triple Draw",
    Controller: AceToFiveTripleDrawController,
    drawCount: 3,
    lowballRule: "A-5",
    alphaStatus: "alpha_candidate",
  },
  {
    variantId: "S01",
    displayName: "2-7 Single Draw",
    Controller: DeuceToSevenSingleDrawController,
    drawCount: 1,
    lowballRule: "2-7",
    alphaStatus: "alpha_candidate",
  },
  {
    variantId: "S02",
    displayName: "A-5 Single Draw",
    Controller: AceToFiveSingleDrawController,
    drawCount: 1,
    lowballRule: "A-5",
    alphaStatus: "alpha_candidate",
  },
]);

function createHand(Controller, seatConfig, { dealerIndex = 0 } = {}) {
  const controller = new Controller({
    tableConfig: {
      seatConfig,
      dealerIndex,
      structure: STRUCTURE,
    },
  });
  const state = controller.createNewHandState({}, { dealerIndex, structure: STRUCTURE });
  return { controller, engineState: state.engineState };
}

function isBettingEligible(player) {
  return Boolean(player && !player.folded && !player.sittingOut && !player.seatOut && !player.isBusted && !player.allIn);
}

function activeSeatCount(state) {
  return state.players.filter((player) => player && !player.sittingOut && !player.seatOut && !player.isBusted).length;
}

function nextEligibleSeat(players, startIndex, predicate = isBettingEligible) {
  for (let offset = 0; offset < players.length; offset += 1) {
    const seatIndex = (startIndex + offset) % players.length;
    if (predicate(players[seatIndex], seatIndex)) return seatIndex;
  }
  return null;
}

function expectedPredrawFirstActor(state) {
  const sbSeat = state.metadata?.lastBlinds?.sbIndex;
  const bbSeat = state.metadata?.lastBlinds?.bbIndex;
  if (activeSeatCount(state) === 2) return sbSeat ?? null;
  if (typeof bbSeat !== "number") return null;
  return nextEligibleSeat(state.players, (bbSeat + 1) % state.players.length);
}

function expectedPostdrawFirstActor(state) {
  return nextEligibleSeat(state.players, (state.dealerIndex + 1) % state.players.length);
}

function classify({ expectedFirstActor, actualFirstActor, variantId, state }) {
  if (!variantId || state.metadata?.variantId !== variantId) return "VARIANT_MAPPING_MISMATCH";
  if (expectedFirstActor !== actualFirstActor) return "ENGINE_WRONG";
  return "PASS";
}

export function buildTripleDrawFirstActorAudit({ generatedAt = new Date().toISOString() } = {}) {
  const rows = [];

  for (const variant of VARIANTS) {
    for (const scenario of [
      { name: "6max-predraw", seatConfig: ["HUMAN", "CPU", "CPU", "CPU", "CPU", "CPU"], stage: "pre-draw" },
      { name: "5max-predraw", seatConfig: ["HUMAN", "CPU", "CPU", "CPU", "CPU"], stage: "pre-draw" },
      { name: "3way-predraw", seatConfig: ["HUMAN", "CPU", "CPU"], stage: "pre-draw" },
      { name: "heads-up-predraw", seatConfig: ["HUMAN", "CPU"], stage: "pre-draw" },
    ]) {
      const { engineState } = createHand(variant.Controller, scenario.seatConfig);
      const expectedFirstActor = expectedPredrawFirstActor(engineState);
      const actualFirstActor = engineState.actingPlayerIndex;
      rows.push({
        variantId: variant.variantId,
        displayName: variant.displayName,
        drawCount: variant.drawCount,
        lowballRule: variant.lowballRule,
        alphaStatus: variant.alphaStatus,
        handId: engineState.handId ?? `${variant.variantId}-${scenario.name}`,
        scenario: scenario.name,
        playerCount: scenario.seatConfig.length,
        buttonSeat: engineState.dealerIndex ?? null,
        sbSeat: engineState.metadata?.lastBlinds?.sbIndex ?? null,
        bbSeat: engineState.metadata?.lastBlinds?.bbIndex ?? null,
        phase: engineState.street ?? null,
        drawRound: engineState.drawRoundIndex ?? null,
        expectedFirstActor,
        actualFirstActor,
        matched: expectedFirstActor === actualFirstActor,
        sourceOfTruth: "controller.engineState.actingPlayerIndex",
        classification: classify({ expectedFirstActor, actualFirstActor, variantId: variant.variantId, state: engineState }),
      });
    }

    const { controller, engineState } = createHand(variant.Controller, ["HUMAN", "CPU"]);
    const postDrawState = controller.engine.transitionToBet({
      ...engineState,
      street: "DRAW",
      drawRoundIndex: 1,
    });
    const expectedFirstActor = expectedPostdrawFirstActor(postDrawState);
    const actualFirstActor = postDrawState.actingPlayerIndex;
    rows.push({
      variantId: variant.variantId,
      displayName: variant.displayName,
      drawCount: variant.drawCount,
      lowballRule: variant.lowballRule,
      alphaStatus: variant.alphaStatus,
      handId: postDrawState.handId ?? `${variant.variantId}-heads-up-postdraw`,
      scenario: "heads-up-postdraw",
      playerCount: 2,
      buttonSeat: postDrawState.dealerIndex ?? null,
      sbSeat: postDrawState.metadata?.lastBlinds?.sbIndex ?? null,
      bbSeat: postDrawState.metadata?.lastBlinds?.bbIndex ?? null,
      phase: postDrawState.street ?? null,
      drawRound: postDrawState.drawRoundIndex ?? null,
      expectedFirstActor,
      actualFirstActor,
      matched: expectedFirstActor === actualFirstActor,
      sourceOfTruth: "controller.engineState.actingPlayerIndex",
      classification: classify({ expectedFirstActor, actualFirstActor, variantId: variant.variantId, state: postDrawState }),
    });
  }

  const status = rows.every((row) => row.classification === "PASS") ? "PASS" : "FAIL";
  return {
    generatedAt,
    status,
    summary: {
      totalRows: rows.length,
      passRows: rows.filter((row) => row.classification === "PASS").length,
      engineWrongRows: rows.filter((row) => row.classification === "ENGINE_WRONG").length,
      variantMappingMismatchRows: rows.filter((row) => row.classification === "VARIANT_MAPPING_MISMATCH").length,
      uiStaleActorRows: 0,
      inconclusiveRows: 0,
    },
    rows,
  };
}

export function writeTripleDrawFirstActorAudit(reportPath = DEFAULT_REPORT_PATH, options = {}) {
  const report = buildTripleDrawFirstActorAudit(options);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const reportPath = process.argv[2] ?? DEFAULT_REPORT_PATH;
  const report = writeTripleDrawFirstActorAudit(reportPath);
  console.log(JSON.stringify({ reportPath, status: report.status, summary: report.summary }, null, 2));
  if (report.status !== "PASS") {
    process.exitCode = 1;
  }
}
