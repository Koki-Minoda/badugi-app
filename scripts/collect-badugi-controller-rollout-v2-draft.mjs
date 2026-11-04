#!/usr/bin/env node
// Offline D03 wiring probe. Its deterministic actions are not a learned model
// and its sessions must never be counted as strength evaluation.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

function argument(name, fallback = null) {
  const prefix = `--${name}=`;
  const entry = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

const outDir = argument('out');
const hands = Number(argument('hands', '10'));
const seed = Number(argument('seed', '2026110401'));
if (!outDir || !Number.isInteger(hands) || hands < 1 || hands > 100 ||
    !Number.isInteger(seed)) {
  throw new TypeError('usage: node scripts/collect-badugi-controller-rollout-v2-draft.mjs --out=DIR [--hands=10] [--seed=2026110401]');
}
const source = fileURLToPath(new URL('../src/rl/badugiControllerRolloutV2Draft.js', import.meta.url));
const temporary = join(tmpdir(), `mgx-d03-v2-rollout-${randomUUID()}.mjs`);
let collect;
try {
  await build({ entryPoints: [source], bundle: true, platform: 'node',
    format: 'esm', outfile: temporary, logLevel: 'silent' });
  process.env.NODE_ENV = 'production'; // Suppress controller diagnostic logs.
  ({ collectBadugiControllerRolloutV2Draft: collect } =
    await import(pathToFileURL(temporary).href));
} finally {
  rmSync(temporary, { force: true });
}
const configurations = [
  [2, false], [3, false], [6, false],
  [2, true], [3, true], [6, true],
];
const sessions = [];
const reports = [];
for (const [index, [seatCount, isTournament]] of configurations.entries()) {
  const sessionSeed = seed + index * 1009;
  const started = performance.now();
  const session = collect({ seatCount, isTournament, hands, seed: sessionSeed });
  sessions.push(session);
  reports.push({ seatCount, isTournament, seed: sessionSeed,
    hands: session.hands.length,
    decisions: session.hands.reduce((count, hand) => count + hand.decisions.length, 0),
    elapsedMs: Math.round(performance.now() - started),
    chipDeltaSum: session.hands.reduce((sum, hand) =>
      sum + hand.chipDeltaBySeat.reduce((a, b) => a + b, 0), 0),
  });
}
const data = `${JSON.stringify({ sessions }, null, 2)}\n`;
const hash = createHash('sha256').update(data).digest('hex');
const summary = {
  status: 'WIRING_PILOT_ONLY', modelUsed: false,
  learnedPolicy: false, strengthEvaluation: false,
  source: 'real Badugi controller and deck with deterministic probe actions',
  observationSchemaVersion: 'badugi-controller-observation-v2-draft',
  sessions: reports,
  totalHands: reports.reduce((sum, report) => sum + report.hands, 0),
  totalDecisions: reports.reduce((sum, report) => sum + report.decisions, 0),
  rolloutSha256: hash,
};
const destination = resolve(outDir);
const dataPath = join(destination, 'rollouts.json');
const summaryPath = join(destination, 'summary.json');
if (existsSync(dataPath) || existsSync(summaryPath)) {
  throw new TypeError('v2 draft refuses to overwrite an existing rollout artifact');
}
mkdirSync(destination, { recursive: true });
writeFileSync(dataPath, data);
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
if (createHash('sha256').update(readFileSync(dataPath)).digest('hex') !== hash) {
  throw new TypeError('v2 draft rollout artifact hash mismatch');
}
console.log(JSON.stringify(summary));
