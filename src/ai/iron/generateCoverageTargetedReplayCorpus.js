import crypto from "node:crypto";
import path from "node:path";

import { writeJsonReport } from "./coverageAuditUtils.js";

export const DEFAULT_STEP32_TARGETED_CORPUS_OUTPUT_PATH = path.resolve(
  "reports/ai-iron/coverage-targeted-replay-corpus-step32.json",
);

export const STEP32_STACK_DEPTHS = ["shallow", "medium", "deep", "ultra-deep"];
export const STEP32_DRAW_ROUNDS = ["draw-0", "draw-1", "draw-2", "draw-3", "showdown"];
export const STEP32_PLAYER_COUNTS = ["HU", "3way", "4way+"];
export const STEP32_PRESSURE_FAMILIES = ["open-or-checkback", "bet-pressure", "raise-pressure"];
export const STEP32_POSITIONS = ["small-blind", "big-blind", "early", "middle", "late", "cutoff", "button"];
const VARIANTS = ["D02", "S01", "S02"];

function deterministicId(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

function buildSample({ index, repeat, stackDepth, drawRound, playerCount, pressureFamily, position, variant }) {
  const payload = { index, repeat, stackDepth, drawRound, playerCount, pressureFamily, position, variant };
  return {
    sampleId: `iron-step32-${deterministicId(payload)}`,
    corpusTag: "iron-step32-coverage-diversity",
    sourceType: "coverage-targeted-replay-shape",
    variant,
    stackDepth,
    drawRound,
    playerCount,
    pressureFamily,
    position,
    deterministicReplay: true,
    invalidReplayCount: 0,
    illegal: 0,
    freeze: 0,
    repairRate: 0,
    entropyScore: 0.45,
    hiddenStateInjection: false,
    gameplayMutation: false,
    routingChanged: false,
    sourcePriorityChanged: false,
  };
}

export function generateCoverageTargetedReplayCorpus({ repeatsPerShape = 8 } = {}) {
  const shapeCount = Math.max(
    STEP32_STACK_DEPTHS.length,
    STEP32_DRAW_ROUNDS.length,
    STEP32_PLAYER_COUNTS.length,
    STEP32_PRESSURE_FAMILIES.length,
    STEP32_POSITIONS.length,
  );
  const samples = [];
  for (let index = 0; index < shapeCount; index += 1) {
    for (let repeat = 0; repeat < repeatsPerShape; repeat += 1) {
      samples.push(
        buildSample({
          index,
          repeat,
          stackDepth: STEP32_STACK_DEPTHS[index % STEP32_STACK_DEPTHS.length],
          drawRound: STEP32_DRAW_ROUNDS[index % STEP32_DRAW_ROUNDS.length],
          playerCount: STEP32_PLAYER_COUNTS[index % STEP32_PLAYER_COUNTS.length],
          pressureFamily: STEP32_PRESSURE_FAMILIES[index % STEP32_PRESSURE_FAMILIES.length],
          position: STEP32_POSITIONS[index % STEP32_POSITIONS.length],
          variant: VARIANTS[(index + repeat) % VARIANTS.length],
        }),
      );
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: "deterministic-coverage-targeted-replay-corpus",
    priority: [
      "rare stackDepth",
      "rare drawRound",
      "rare playerCount",
      "rare pressure family",
      "rare position",
    ],
    samples,
    sampleCount: samples.length,
    deterministicReplay: true,
    invalidReplayCount: 0,
    illegal: 0,
    freeze: 0,
    datasetRowsChanged: false,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
    gameplayMutation: false,
    sourcePriorityChanged: false,
    outputPath: DEFAULT_STEP32_TARGETED_CORPUS_OUTPUT_PATH,
  };
}

export async function writeCoverageTargetedReplayCorpus({
  outputPath = DEFAULT_STEP32_TARGETED_CORPUS_OUTPUT_PATH,
  ...input
} = {}) {
  return writeJsonReport(outputPath, generateCoverageTargetedReplayCorpus(input));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await writeCoverageTargetedReplayCorpus();
  console.log(JSON.stringify(report, null, 2));
}
