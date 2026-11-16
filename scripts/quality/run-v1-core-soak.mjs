#!/usr/bin/env node
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_GAMES, CORE_QA_TARGETS } from './v1-core-contract.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = arg.match(/^--([a-z-]+)=(.+)$/);
  if (!match) throw new Error(`Expected --key=value: ${arg}`);
  return [match[1], match[2]];
}));
const allowed = new Set(['variants', 'seeds', 'hands-per-seed', 'report']);
for (const key of Object.keys(args)) if (!allowed.has(key)) throw new Error(`Unknown argument: ${key}`);
function positive(value, fallback) {
  const n = Number(value ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('Counts must be positive safe integers');
  return n;
}
const seedCount = positive(args.seeds, CORE_QA_TARGETS.seedsPerGame);
const handsPerSeed = positive(args['hands-per-seed'], CORE_QA_TARGETS.engineHandsPerGame / CORE_QA_TARGETS.seedsPerGame);
const ids = args.variants?.split(',') ?? CORE_GAMES.map(game => game.id);
if (new Set(ids).size !== ids.length || ids.some(id => !CORE_GAMES.some(game => game.id === id))) {
  throw new Error('Variants must be unique Core catalog IDs');
}
const reportPath = path.resolve(root, args.report ?? 'reports/release-v1/engine-soak.json');
if (fs.existsSync(reportPath)) throw new Error(`Preserve existing evidence; choose a new --report: ${reportPath}`);
const git = (...argv) => execFileSync('git', argv, { cwd: root, encoding: 'utf8' }).trim();
const sources = [...git('ls-files', 'src/games').split('\n'),
  'scripts/quality/run-v1-core-soak.mjs', 'scripts/quality/v1-core-contract.mjs'];
const sourceHashes = Object.fromEntries(sources.filter(Boolean).sort().map(file => [file,
  createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
const report = {
  schema: 'mgx-v1-engine-soak-v1', startedAt: new Date().toISOString(),
  sourceCommit: git('rev-parse', 'HEAD'), sourceDirty: Boolean(git('status', '--porcelain')),
  sourceHashes, config: { ids, seedCount, handsPerSeed, seatCounts: [2, 3, 4, 5, 6] },
  scope: 'Independent sampled controller hands with passive check/call/pat policy; fresh bankroll per hand. Not continuous cash, CPU strength, browser, tournament or independent evaluator certification.',
  status: 'RUNNING', rows: [],
};
function save() {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const temporary = `${reportPath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`);
  fs.renameSync(temporary, reportPath);
}
save();
const server = await createServer({ root, mode: 'test', server: { middlewareMode: true }, logLevel: 'error' });
try {
  const { runProgressScenario } = await server.ssrLoadModule('/src/games/testing/scenario/runProgressScenario.js');
  for (const id of ids) {
    for (let group = 0; group < seedCount; group++) {
      const row = { id, group, requested: handsPerSeed, completed: 0, strictSettlements: 0, status: 'RUNNING' };
      report.rows.push(row);
      const began = Date.now();
      for (let hand = 0; hand < handsPerSeed; hand++) {
        const seed = `mgx-v1-${id}-${group}-${hand}`;
        const seatCount = 2 + ((hand + group) % 5);
        try {
          const result = runProgressScenario({ variantId: id, seed, handCount: 1, maxSteps: 320,
            harnessOptions: { seatCount } });
          if (result.status !== 'passed' || result.handsCompleted !== 1 ||
              result.strictSettlements.length !== 1 ||
              !result.strictSettlements.every(s => s.ok && s.status === 'ENFORCED')) {
            throw new Error(`Incomplete strict hand: ${JSON.stringify(result)}`);
          }
          row.completed++;
          row.strictSettlements++;
        } catch (error) {
          row.status = 'FAIL';
          row.failure = { seed, seatCount, hand, message: String(error.message ?? error) };
          break;
        }
      }
      if (row.status !== 'FAIL') row.status = 'PASS';
      row.elapsedMs = Date.now() - began;
      save();
      process.stdout.write(`${id} seed-group ${group}: ${row.status} ${row.completed}/${handsPerSeed}\n`);
      if (row.status === 'FAIL') break;
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  report.completedAt = new Date().toISOString();
  report.status = report.rows.some(row => row.status !== 'PASS') ? 'FAIL' : 'PASS_SAMPLED_PASSIVE_SCOPE';
  report.releaseGatePassed = false;
  save();
  process.exitCode = report.status === 'FAIL' ? 1 : 0;
} catch (error) {
  report.status = 'ERROR'; report.error = String(error.stack ?? error); save(); process.exitCode = 1;
} finally { await server.close(); }
