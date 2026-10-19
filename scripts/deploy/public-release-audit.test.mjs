import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditPublicRelease, findUnpublishedRuntimePaths } from './verify-public-release.mjs';

const commit = 'a'.repeat(40);
const origin = 'https://mgx.example';
const html = `<html><head><meta name="mgx-release" content="${commit}"><script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css"></head></html>`;
const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex');
function mockFetch(overrides = {}) {
  return async input => {
    const url = new URL(input);
    assert.equal(url.origin, origin);
    const path = url.pathname;
    const normal = path === '/release.json' ? [JSON.stringify({ commit }), 'application/json']
      : path === '/api/health' ? [JSON.stringify({status:'ok',env:'prod',db:'ok'}), 'application/json']
      : path.endsWith('.png') ? [png, 'image/png']
      : path.endsWith('.js') ? ['export const loaded = true;', 'text/javascript']
      : path.endsWith('.css') ? ['body { color: black; }', 'text/css']
      : [html, 'text/html'];
    const [body, type, status = 200] = overrides[path] ?? normal;
    return new Response(body, { status, headers: {'content-type':type} });
  };
}
const options = { origin, portraitNames:['akira.png','mina.png'], fetchImpl:mockFetch() };
test('record actual release separately from test source and verify public resources', async () => {
  const report = await auditPublicRelease(options);
  assert.equal(report.status, 'PASS', JSON.stringify(report));
  assert.equal(report.publishedCommit, commit);
  assert.equal(report.portraits.length, 2);
  assert.ok(report.requests.some(r => r.path === '/settings'));
});
for (const [name, overrides, message] of [
  ['HTML identity mismatch', {'/':[html.replace(commit, 'b'.repeat(40)), 'text/html']}, /HTML release/],
  ['SPA fallback for JS', {'/assets/app.js':['<html>fallback</html>','text/html']}, /JavaScript/],
  ['SPA fallback for PNG', {'/characters/akira.png':['<html>fallback</html>','image/png']}, /PNG/],
  ['missing image', {'/characters/mina.png':['missing','text/plain',404]}, /404/],
  ['stale deep link', {'/practice':[html.replace(commit, 'b'.repeat(40)), 'text/html']}, /HTML release/],
  ['database unhealthy', {'/api/health':[JSON.stringify({status:'ok',env:'prod',db:'error'}),'application/json']}, /database/],
  ['missing CSS', {'/':[html.replace('<link rel="stylesheet" href="/assets/app.css">',''),'text/html']}, /CSS entry/],
  ['foreign assets', {'/':[html.replace('/assets/app.js','https://foreign.example/app.js'),'text/html']}, /same-origin/],
  ['unsafe metadata', {'/release.json':[JSON.stringify({commit:'HEAD; exit 0'}),'application/json']}, /full commit/],
]) test(`reject ${name}`, async () => {
  const report = await auditPublicRelease({...options,fetchImpl:mockFetch(overrides)});
  assert.equal(report.status,'FAIL');
  assert.match(report.issues.join('\n'), message);
});
test('failed transport produces a failure report', async () => {
  const report = await auditPublicRelease({...options,fetchImpl:async()=>{throw new Error('timeout');}});
  assert.equal(report.status,'FAIL');assert.match(report.issues[0], /timeout/);
});
test('explicit tested commit rejects a different published release', async () => {
  const report = await auditPublicRelease({...options, expectedCommit:'b'.repeat(40)});
  assert.equal(report.status,'FAIL');assert.match(report.issues[0], /expected commit/);
});
test('Git comparison permits test-only drift but rejects runtime changes and deletions', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mgx-release-audit-'));
  const git = (...args) => execFileSync('git', args, {cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const save = (file, text) => {mkdirSync(join(cwd,file,'..'),{recursive:true});writeFileSync(join(cwd,file),text);};
  const snapshot = () => {git('add','.');git('-c','user.name=MGX Test','-c','user.email=test@example.invalid','commit','-qm','fixture');return git('rev-parse','HEAD');};
  try {
    git('init','-q');save('src/main.js','old');save('public/characters/akira.png','portrait');const published=snapshot();
    save('tests/e2e/portraits.spec.ts','test');save('scripts/deploy/verify-public-release.mjs','audit');save('scripts/deploy/README.md','docs');const testOnly=snapshot();
    assert.deepEqual(findUnpublishedRuntimePaths({cwd,publishedCommit:published,sourceCommit:testOnly}),[]);
    save('src/main.js','new');rmSync(join(cwd,'public/characters/akira.png'));const changed=snapshot();
    assert.deepEqual(findUnpublishedRuntimePaths({cwd,publishedCommit:published,sourceCommit:changed}),['public/characters/akira.png','src/main.js']);
    assert.throws(()=>findUnpublishedRuntimePaths({cwd,publishedCommit:'c'.repeat(40),sourceCommit:changed}));
    assert.throws(()=>findUnpublishedRuntimePaths({cwd,publishedCommit:published,sourceCommit:'--help'}),/full commit/);
  } finally {rmSync(cwd,{recursive:true,force:true});}
});

test('reject a release that changes during the audit', async () => {
  const normal = mockFetch();let metadataReads = 0;
  const report = await auditPublicRelease({...options,fetchImpl:async (url, init)=>{
    if (new URL(url).pathname==='/release.json' && ++metadataReads===2) return new Response(JSON.stringify({commit:'b'.repeat(40)}),{headers:{'content-type':'application/json'}});
    return normal(url,init);
  }});
  assert.equal(report.status,'FAIL');assert.match(report.issues[0],/changed during verification/);
});
test('reject explicitly empty expected or source SHA instead of skipping verification', async () => {
  for (const extra of [{expectedCommit:''},{sourceCommit:''}]) {
    const report = await auditPublicRelease({...options,...extra});
    assert.equal(report.status,'FAIL');assert.match(report.issues[0],/full commit/);
  }
});
