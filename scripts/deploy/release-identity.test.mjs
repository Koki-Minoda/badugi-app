import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
const expected = process.env.VITE_MGX_BUILD_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
function verify(commit) {
  return spawnSync(process.execPath, ['scripts/deploy/verify-release-build.mjs', 'dist', commit], {encoding:'utf8'});
}
test('built HTML and metadata identify the tested checkout', () => {
  const result = verify(expected);
  assert.equal(result.status, 0, result.stderr);
});
test('reject an older or otherwise different release before publishing', () => {
  const result = verify('0'.repeat(40));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Built release must match/);
});
test('reject an archive build without an explicit commit', () => {
  const result = verify('unknown');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /tested full commit/);
});
