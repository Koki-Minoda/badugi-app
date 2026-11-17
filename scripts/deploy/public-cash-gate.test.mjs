import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PUBLIC_RING_PLAYABLE_VARIANTS} from '../../src/games/config/variantAvailability.js';
import {summarizeCore5CashQm} from '../quality/summarize-core5-cash-qm.mjs';

const workflow = readFileSync(new URL('../../.github/workflows/deploy-mgx-prod-01.yml', import.meta.url), 'utf8');
const job = name => workflow.split(/(?=^  [a-z][a-z0-9-]*:\n)/m).find(block => block.startsWith(`  ${name}:\n`)) ?? '';

test('both device shards retain lifecycle and ten-hand real-button coverage', () => {
  const shard = job('core5-device-qa');
  assert.match(shard, /device: \[desktop, android\]/);
  assert.match(shard, /fail-fast: false/);
  assert.match(shard, /npm run test:core5:pr-e2e/);
  assert.match(shard, /MGX_ALL_LIVE_CASH_HANDS: "10"/);
  assert.ok(shard.includes('MGX_ALL_LIVE_CASH_DEVICES: ${{ matrix.device }}'));
  assert.match(shard, /all-live-core5-cash-production\.spec\.ts/);
  assert.ok(shard.includes('name: public-cash-qm-${{ github.run_attempt }}-${{ matrix.device }}'));
});

test('the protected core5 check rejects failed/skipped shards and requires the full strict summary', () => {
  const gate = job('core5-qa');
  assert.match(gate, /needs: core5-device-qa/);
  assert.match(gate, /if: always\(\)/);
  assert.ok(gate.includes('SHARD_RESULT: ${{ needs.core5-device-qa.result }}'));
  assert.ok(gate.includes('run: test "$SHARD_RESULT" = success'));
  assert.ok(gate.includes('pattern: public-cash-qm-${{ github.run_attempt }}-*'));
  assert.match(gate, /merge-multiple: true/);
  assert.match(gate, /node scripts\/quality\/summarize-core5-cash-qm\.mjs reports\/core5-cash-shards/);
  assert.match(job('deploy'), /- core5-qa/);
});

function evidence(devices, mutate = report => report) {
  const dir = mkdtempSync(join(tmpdir(), 'mgx-cash-gate-'));
  for (const variant of PUBLIC_RING_PLAYABLE_VARIANTS) for (const device of devices) {
    const fixedBlind = variant.cashQm?.expectsBlindIncrease === false;
    const report = mutate({status:'PASS',variant:variant.id,device,handsCompleted:10,nextHandClicks:9,
      openingBlind:{level:1,bigBlind:20},closingBlind:{level:fixedBlind?1:2,bigBlind:fixedBlind?20:40},
      totalHeroButtonClicks:5,totalDrawClicks:variant.cashQm?.expectsDraw===false?0:1,
      history:{records:10},cashOut:true,rows:Array.from({length:10},()=>({}))});
    writeFileSync(join(dir, `${variant.id.toLowerCase()}-${device}-10-hands.json`), JSON.stringify(report));
  }
  try { return summarizeCore5CashQm({reportDir:dir}); }
  finally { rmSync(dir, {recursive:true,force:true}); }
}

test('all public variants on both devices pass the unchanged summary contract', () => {
  const summary = evidence(['desktop','android']);
  assert.equal(summary.status, 'PASS');
  assert.equal(summary.completedCases, PUBLIC_RING_PLAYABLE_VARIANTS.length * 2);
});
test('one complete device shard cannot pass the full gate', () => {
  const summary = evidence(['desktop']);
  assert.equal(summary.status, 'FAIL');
  assert.deepEqual(summary.expectedDevices, ['desktop','android']);
  assert.equal(summary.issues.filter(issue => issue.code==='MISSING_REPORT').length, PUBLIC_RING_PLAYABLE_VARIANTS.length);
});
test('combined artifacts cannot disguise insufficient hands or mismatched identity', () => {
  const summary = evidence(['desktop','android'], report => report.device==='android' ? {...report,handsCompleted:9,device:'desktop'} : report);
  assert.equal(summary.status, 'FAIL');
  assert.ok(summary.issues.every(issue => issue.failedChecks.includes('hands') && issue.failedChecks.includes('identity')));
});
