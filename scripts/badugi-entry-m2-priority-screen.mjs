// Worker used by the guarded priority-screen entry point. It previews only
// the predeclared hero's cards and never runs the controller or an opponent.
import { createHash } from 'node:crypto';
import { closeSync, fsyncSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateHand } from '../src/games/badugi/utils/badugiEvaluator.js';
import { previewBadugiPredrawHeroHand } from '../src/rl/training/screen_badugi_predraw_range_seeds.mjs';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function classify(cards) {
  const { count, ranks } = evaluateHand(cards.map((card) => ({
    rank: RANKS.indexOf(card.slice(0, -1)) + 1,
    suit: card.at(-1),
  })));
  if (count === 3 && ranks.join(',') === '1,6,10') return 'A6T_boundary';
  if (count === 2 && ranks[0] === 1 && ranks[1] >= 2 && ranks[1] <= 6) return 'A2_A6_two_card';
  if (count === 4 && ranks.at(-1) >= 10) return 'T_K_four_card';
  return 'other';
}

export function previewQueue(queue, schedule, profiles, record) {
  const selected = [];
  let previewed = 0;
  const [seatCount, occupiedSeatCount] = queue.group;
  for (let ordinal = 0; ordinal < queue.maxPreviews; ordinal += 1) {
    const reservedIndex = queue.reservedOffset + ordinal;
    const seed = schedule.readUInt32LE(reservedIndex * 4);
    const { heroSeat, queueIndex } = queue;
    const cards = previewBadugiPredrawHeroHand({ seed, seatCount, occupiedSeatCount, heroSeat });
    const stratum = classify(cards);
    record({ queueIndex, screenOrdinal: ordinal, reservedIndex, seed, heroSeat, cards, stratum });
    previewed += 1;
    if (stratum !== queue.stratum) continue;
    selected.push({
      queueIndex, screenOrdinal: ordinal, reservedIndex, seed, group: queue.group,
      profile: profiles[selected.length % profiles.length], stratum, heroSeat,
      expectedOpeningDealerSeat: queue.expectedOpeningDealerSeat,
      expectedOpeningPosition: queue.openingPosition, expectedOpeningActorCards: cards,
    });
    if (selected.length === queue.requiredAccepts) break;
  }
  return { selected, previewed };
}

function writeNew(path, contents) {
  const file = openSync(path, 'wx');
  try {
    writeFileSync(file, contents);
    fsyncSync(file);
  } finally {
    closeSync(file);
  }
}

function runWorker() {
  const { folder, design, scheduleFile, scheduleSha256, screenPlanSha256,
    traceFile, selectedFile, resultFile } = JSON.parse(readFileSync(0, 'utf8'));
  const schedule = readFileSync(join(folder, scheduleFile));
  if (schedule.length !== design.maxReservedDeals * 4 || sha(schedule) !== scheduleSha256) {
    throw new Error('M2 screen worker reservation changed after preflight');
  }
  const selected = [];
  const shortQueues = [];
  let previewedDeals = 0;
  const trace = openSync(join(folder, traceFile), 'wx');
  const digest = createHash('sha256');
  let lines = [];
  const flush = () => {
    if (!lines.length) return;
    const bytes = Buffer.from(lines.join(''), 'utf8');
    writeFileSync(trace, bytes);
    digest.update(bytes);
    lines = [];
  };
  try {
    const record = (row) => {
      lines.push(JSON.stringify(row) + '\n');
      if (lines.length >= 1024) flush();
    };
    for (const queue of design.queues) {
      const result = previewQueue(queue, schedule, design.profilesInAcceptanceOrder, record);
      previewedDeals += result.previewed;
      selected.push(...result.selected);
      if (result.selected.length !== queue.requiredAccepts) {
        shortQueues.push({ queueIndex: queue.queueIndex, accepted: result.selected.length });
      }
    }
    flush();
    fsyncSync(trace);
  } finally {
    closeSync(trace);
  }
  const result = {
    schema: 'mgx-d03-entry-m2-priority-screen-result/v2',
    status: shortQueues.length ? 'INSUFFICIENT_SCREEN_ALLOCATION' : 'SCREENED_FOR_PRIORITY_SAFETY_COLLECTION',
    screenPlanSha256, screenTraceSha256: digest.digest('hex'),
    previewedDeals, unusedReservedDeals: design.maxReservedDeals - previewedDeals,
    acceptedAttempts: selected.length, shortQueues,
  };
  if (!shortQueues.length) {
    const bytes = Buffer.from(JSON.stringify(selected) + '\n', 'utf8');
    writeNew(join(folder, selectedFile), bytes);
    result.selectedSha256 = sha(bytes);
  }
  writeNew(join(folder, resultFile), JSON.stringify(result, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runWorker();
