/** Offline Iron input sensitivity only: no played hands and no EV inference. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as ort from 'onnxruntime-web';
import { buildBadugiObservationPayload, buildBadugiObservationVector } from '../../src/rl/badugiObservationSchema.js';

const output = process.argv[2];
if (!output) throw new Error('Provide an output JSON path');
const modelPath = new URL('../../public/models/badugi_iron_v1.onnx', import.meta.url);
const modelBytes = await readFile(modelPath);
const modelSha256 = createHash('sha256').update(modelBytes).digest('hex');
const expectedModelSha256 = '172c5057712630782864949b5ac0098d9b4f510ea56ce2464afb49f3959dca05';
if (modelSha256 !== expectedModelSha256) throw new Error('Iron model asset changed');
ort.env.wasm.numThreads = 1;
const session = await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'] });

function shuffledDeck(seed) {
  const deck = Array.from({ length: 52 }, (_, n) => [Math.floor(n / 4), n % 4]);
  let state = seed >>> 0;
  for (let i = deck.length - 1; i > 0; i -= 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    const j = state % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function makeCase(seed, drawRound, phase, seat) {
  const cards = shuffledDeck(seed);
  const scenario = seed - 4100;
  const players = Array.from({ length: 6 }, (_, index) => ({
    seatIndex: index,
    hand: cards.slice(index * 4, index * 4 + 4),
    stack: 60 + 9 * index + scenario * 3,
    betThisRound: phase === 'BET' ? (index % 2) * 2 : 0,
    folded: false,
    lastDrawCount: drawRound ? (index + scenario) % 4 : 0,
    drawHistory: [0, 1, 2].map((round) => round < drawRound ? (index + scenario + round) % 4 : 0),
    betHistory: [0, 1, 2].map((round) => round < drawRound && (index + scenario + round) % 2 === 0),
    openedCurrentRound: phase === 'BET' && (index + scenario) % 3 === 0,
    discardedCards: drawRound ? [[(index + scenario) % 13, index % 4]] : [],
    aggressionRate: 0.1 + index * 0.06,
    foldRate: 0.2 + index * 0.04,
    patRate: drawRound ? index / 10 : 0,
  }));
  const currentBet = phase === 'BET' ? (scenario % 2 === 0 ? 2 : 4) : 0;
  const toCall = Math.max(0, currentBet - players[seat].betThisRound);
  const legalActions = phase === 'DRAW'
    ? ['draw_0', 'draw_1', 'draw_2', 'draw_3']
    : toCall ? ['FOLD', 'CALL', 'RAISE'] : ['CHECK', 'BET'];
  const state = {
    variantId: 'D03', players, dealerIndex: scenario % 6, actingPlayerIndex: seat,
    street: phase, drawRoundIndex: drawRound, maxDrawRounds: 3,
    currentBet, raiseCount: scenario % 3, pot: 3 + scenario * 8 + drawRound * 15,
  };
  return { phase, drawRound, scenario, seat, legalActions,
    observation: buildBadugiObservationPayload({ state, seatIndex: seat, legalActions }) };
}

function legalIndices(item) {
  if (item.phase === 'DRAW') return [0, 1, 2, 3];
  const names = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN'];
  return names.map((name, index) => item.legalActions.includes(name) ? index : -1).filter((index) => index >= 0);
}

async function run(vector) {
  const tensor = new ort.Tensor('float32', vector, [96]);
  const result = await session.run({ input: tensor });
  const scores = Array.from(result.output.data);
  if (scores.length !== 6 || scores.some((score) => !Number.isFinite(score))) throw new Error('Invalid ONNX output');
  return scores;
}

const rows = [];
for (const seed of [4100, 4101, 4102, 4103]) {
  for (const drawRound of [0, 1, 2, 3]) {
    for (const phase of ['BET', 'DRAW']) {
      if (phase === 'DRAW' && drawRound === 3) continue;
      for (let seat = 0; seat < 6; seat += 1) {
        const item = makeCase(seed, drawRound, phase, seat);
        // Iron's ev-range featureSet leaves this browser vector unchanged in the adapter.
        const current = new Float32Array(buildBadugiObservationVector(item.observation));
        const legacyZeroPad = new Float32Array(current);
        legacyZeroPad.fill(0, 61, 75);
        const currentScores = await run(current);
        const legacyScores = await run(legacyZeroPad);
        const legal = legalIndices(item);
        const choose = (scores) => legal.reduce((best, index) => scores[index] > scores[best] ? index : best);
        rows.push({ phase, drawRound, scenario: item.scenario, seat,
          changedFeatureCount: Array.from(current.slice(61, 75)).filter((value) => value !== 0).length,
          currentAction: choose(currentScores), legacyZeroPadAction: choose(legacyScores),
          maxAbsQDifference: Math.max(...currentScores.map((value, index) => Math.abs(value - legacyScores[index]))),
        });
      }
    }
  }
}

const summarize = (selected) => ({
  cases: selected.length,
  actionDifferences: selected.filter((row) => row.currentAction !== row.legacyZeroPadAction).length,
  nonzeroHistoryCases: selected.filter((row) => row.changedFeatureCount > 0).length,
  maxAbsQDifference: Math.max(...selected.map((row) => row.maxAbsQDifference)),
});
const report = {
  status: 'SYNTHETIC_IRON_INPUT_SENSITIVITY_ONLY_NO_EV_CLAIM',
  sourceBasisCommit: '7c09d3f0830e9e3113f292644ed8ff20817afa7b',
  modelSha256,
  intervention: 'On the current browser input for the same synthetic state, zero only slots 61-74 to emulate the committed pre-v2 padding; all other 82 slots and legal-action set stay fixed.',
  limitations: 'Constructed states are not independent played sessions; historical saved-checkpoint tensors are unavailable. Action changes and Q-value changes do not establish chip/hand, strength, causality, or production frequency.',
  total: summarize(rows),
  byPhase: Object.fromEntries(['BET', 'DRAW'].map((phase) => [phase, summarize(rows.filter((row) => row.phase === phase))])),
  byDrawRound: Object.fromEntries([0, 1, 2, 3].map((round) => [round, summarize(rows.filter((row) => row.drawRound === round))])),
  rows,
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ total: report.total, byPhase: report.byPhase })}\n`);
