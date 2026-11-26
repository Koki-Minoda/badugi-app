#!/usr/bin/env node
// Offline M2 predeal screen. Selection reads only the designated hero's own
// opening four cards; it never asks the controller to play or reads rewards.
import { createHash } from 'node:crypto';
import { readFileSync, createWriteStream, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { evaluateHand } from '../src/games/badugi/utils/badugiEvaluator.js';
import { previewBadugiPredrawHeroHand } from '../src/rl/training/screen_badugi_predraw_range_seeds.mjs';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const STRATA = ['A6T_boundary', 'A2_A6_two_card', 'T_K_four_card', 'other'];
function sha(buffer) { return createHash('sha256').update(buffer).digest('hex'); }

function classify(cards) {
  const evaluated = evaluateHand(cards.map((card) => {
    const match = card.match(/^(10|[2-9AJQK])([SHDC])$/);
    if (!match) throw new TypeError('M2 screen requires standard hero card labels');
    return { rank: RANKS.indexOf(match[1]) + 1, suit: match[2] };
  }));
  const ranks = evaluated.ranks.map((rank) => rank - 1);
  if (evaluated.count === 3 && ranks.join(',') === '0,5,9') return STRATA[0];
  if (evaluated.count === 2 && ranks[0] === 0 && ranks[1] >= 1 && ranks[1] <= 5) return STRATA[1];
  if (evaluated.count === 4 && ranks.at(-1) >= 9) return STRATA[2];
  return STRATA[3];
}

const planPath = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new TypeError('M2 screen requires a frozen plan path');
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const folder = dirname(planPath);
const repo = resolve(import.meta.dirname, '..');
const codeSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim();
const selfSha = sha(readFileSync(new URL(import.meta.url)));
if (plan.schema !== 'mgx-d03-entry-m2-hero-screen/v1' ||
    plan.status !== 'FROZEN_BEFORE_SCREEN' ||
    plan.stage !== 'HERO_OWN_OPENING_CARDS_ONLY_NO_REWARD' ||
    plan.unmatchedDirectAuditStatus !== 'PASS_ALL_UNMATCHED_JSONL_NO_COLLISION' ||
    !plan.unmatchedDirectAuditFile || !plan.unmatchedDirectAuditSha256 ||
    plan.codeGitSha !== codeSha || dirty || plan.screenCodeSha256 !== selfSha ||
    plan.screenCapPerCell !== 30000 || plan.acceptedPerCellStratum !== 25 ||
    plan.screenCount !== 1500000) throw new TypeError('M2 screen plan or code changed');
if (sha(readFileSync(plan.sourceManifestFile)) !== plan.sourceManifestSha256) {
  throw new TypeError('M2 prior source inventory manifest changed');
}
if (sha(readFileSync(plan.unmatchedDirectAuditFile)) !== plan.unmatchedDirectAuditSha256) {
  throw new TypeError('M2 unmatched JSONL collision audit missing or changed');
}
const schedule = readFileSync(join(folder, plan.screenSeedScheduleFile));
if (schedule.length !== plan.screenCount * 4 || sha(schedule) !== plan.screenSeedScheduleSha256) {
  throw new TypeError('M2 screen seed schedule size or SHA mismatch');
}
const prior = readFileSync(plan.recordedDeckResiduesFile);
if (prior.length !== plan.recordedDeckResiduesCount * 4 ||
    sha(prior) !== plan.recordedDeckResiduesSha256) throw new TypeError('M2 prior index changed');
const reserved = readFileSync(join(folder, plan.screenedDeckResiduesFile));
if (reserved.length !== schedule.length || sha(reserved) !== plan.screenedDeckResiduesSha256) {
  throw new TypeError('M2 all-screened residue reservation changed');
}
const tracePath = join(folder, plan.screenTraceFile);
const selectedPath = join(folder, plan.selectedSeedsFile);
const resultPath = join(folder, 'screen-result.json');
if (existsSync(tracePath) || existsSync(selectedPath) || existsSync(resultPath)) {
  throw new TypeError('M2 screen output exists; never overwrite a partial or completed original');
}
const trace = createWriteStream(tracePath, { flags: 'wx' });
const selected = [];
const counts = {};
const cells = plan.groups.flatMap((group) => plan.profiles.map((profile) => ({ group, profile })));
if (cells.length !== 50 || plan.strata.join(',') !== STRATA.join(',')) {
  throw new TypeError('M2 screen matrix changed');
}
for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
  const { group, profile } = cells[cellIndex];
  const occupied = group[1];
  const perStratum = Object.fromEntries(STRATA.map((name) => [name, 0]));
  for (let offset = 0; offset < plan.screenCapPerCell; offset += 1) {
    const globalIndex = cellIndex * plan.screenCapPerCell + offset;
    const seed = schedule.readUInt32LE(globalIndex * 4);
    const heroSeat = offset % occupied;
    const cards = previewBadugiPredrawHeroHand({ seed, seatCount: group[0],
      occupiedSeatCount: occupied, heroSeat });
    const stratum = classify(cards);
    trace.write(`${JSON.stringify({ globalIndex, seed, cellIndex, heroSeat, cards, stratum })}\n`);
    if (perStratum[stratum] < plan.acceptedPerCellStratum) {
      selected.push({ seed, group, profile, heroSeat, stratum,
        expectedOpeningActorCards: cards });
      perStratum[stratum] += 1;
    }
  }
  counts[cellIndex] = perStratum;
}
await new Promise((done, fail) => { trace.on('error', fail); trace.end(done); });
const short = Object.entries(counts).flatMap(([cell, values]) => STRATA
  .filter((name) => values[name] !== plan.acceptedPerCellStratum)
  .map((name) => ({ cell: Number(cell), stratum: name, accepted: values[name] })));
const result = { status: short.length ? 'INSUFFICIENT' : 'SCREENED_FOR_SAFETY_COLLECTION',
  screenCount: plan.screenCount, selectedCount: selected.length, short,
  traceSha256: sha(readFileSync(tracePath)),
  allScreenedResiduesSha256: plan.screenedDeckResiduesSha256,
  limit: 'Hero-own opening card screen only; no legal action, EV, or strength evidence' };
if (!short.length) {
  const output = createWriteStream(selectedPath, { flags: 'wx' });
  output.end(`${JSON.stringify(selected)}\n`);
  await new Promise((done, fail) => { output.on('error', fail); output.on('finish', done); });
  result.selectedSeedsSha256 = sha(readFileSync(selectedPath));
}
writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${JSON.stringify(result)}\n`);
