import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {summarizeV1BrowserEvidence} from './v1-browser-summary.mjs';
const sha='a'.repeat(40);
test('missing 30 cases remains incomplete, never vacuous pass',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'mgx-v1-missing-'));
  const r=summarizeV1BrowserEvidence({root,expectedCommit:sha});
  assert.equal(r.status,'INCOMPLETE');assert.equal(r.completedCases,0);assert.equal(r.rows.length,30);assert.equal(r.releaseGatePassed,false);
});
test('wrong served SHA rejects an otherwise complete-looking report',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'mgx-v1-stale-'));
  fs.mkdirSync(path.join(root,'browser-desktop-root'));
  const r={status:'PASS',variant:'nlh',device:'desktop',servedCommit:'b'.repeat(40),handsCompleted:100,nextHandClicks:99,totalHeroButtonClicks:100,history:{records:100},cashOut:true,rows:Array.from({length:100},()=>({})),browserEngine:'chromium'};
  fs.writeFileSync(path.join(root,'browser-desktop-root','nlh-desktop-100-hands.json'),JSON.stringify(r));
  const summary=summarizeV1BrowserEvidence({root,expectedCommit:sha});
  assert.equal(summary.status,'FAIL');assert.deepEqual(summary.rows.find(r=>r.id==='B01'&&r.device==='desktop').failures,['release']);
});
