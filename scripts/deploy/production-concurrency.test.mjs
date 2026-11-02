import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=name=>fs.readFileSync(new URL(`../../.github/workflows/${name}`,import.meta.url),'utf8');
const deploy=read('deploy-mgx-prod-01.yml');
const nightly=read('production-live-nightly.yml');
test('production dispatch and nightly hold one shared non-canceling lock',()=>{
  const group=nightly.match(/^  group: (\S+)$/m)?.[1];
  assert.equal(group,'mgx-production-live');
  assert.ok(deploy.includes(`github.event_name == 'workflow_dispatch' && '${group}'`));
  for(const workflow of [deploy,nightly])assert.match(workflow,/concurrency:\n  group: [^\n]+\n  cancel-in-progress: false\n  queue: max/);
});
test('PR and push checks retain their own lock and cannot deploy',()=>{
  assert.match(deploy,/\|\| format\('mgx-prod-01-\{0\}', github.event.pull_request.number \|\| github.ref\)/);
  const deployJob=deploy.slice(deploy.indexOf('\n  deploy:'));
  assert.match(deployJob,/if: github.event_name == 'workflow_dispatch'/);
});
