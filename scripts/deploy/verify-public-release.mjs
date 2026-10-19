import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHA = /^[a-f0-9]{40}$/;
const ROUTES = ['/learn', '/practice', '/review', '/friend-match', '/tournament', '/settings', '/tools', '/try', '/meetups'];

// Fail closed for unknown files. Only evidence, tests and CI instructions can
// differ without changing the application delivered to players.
function isVerificationOnly(path) {
  return /^(tests\/|e2e\/|reports\/|docs\/|\.github\/|backend\/tests\/)/.test(path)
    || /(^|\/)__tests__\//.test(path)
    || /\.(test|spec)\.(js|jsx|ts|tsx|mjs)$/.test(path)
    || /^(playwright|vitest)(\.[\w-]+)*\.config\.(js|ts|mjs)$/.test(path)
    || /(^|\/)(README|AGENTS|CLAUDE)\.md$/.test(path)
    || path === 'scripts/deploy/verify-public-release.mjs';
}

export function findUnpublishedRuntimePaths({cwd = ROOT, publishedCommit, sourceCommit}) {
  assert.match(publishedCommit ?? '', SHA, 'Published release must be a full commit SHA');
  assert.match(sourceCommit ?? '', SHA, 'Source must be a full commit SHA');
  const git = args => execFileSync('git', args, {cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  // A missing/shallow history or unrelated deployment must not look like no diff.
  git(['merge-base','--is-ancestor',publishedCommit,sourceCommit]);
  return git(['diff','--name-only','--no-renames','-z',publishedCommit,sourceCommit,'--'])
    .split('\0').filter(Boolean).filter(path => !isVerificationOnly(path)).sort();
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(m=>[m[1].toLowerCase(),m[3]]));
}
function readHtml(html, commit, origin) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>attributes(m[0])).filter(a=>a.name==='mgx-release');
  assert.equal(metas.length,1,'HTML release metadata must appear once');
  assert.equal(metas[0].content,commit,'HTML release must match published metadata');
  const entries = new Set();
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const a = attributes(match[0]);
    const ref = a.type==='module' ? a.src : ['stylesheet','modulepreload'].includes(a.rel) ? a.href : null;
    if (!ref) continue;
    const url = new URL(ref,origin);
    assert.equal(url.origin,origin,'Entry assets must be same-origin');
    assert.ok(url.pathname.startsWith('/assets/'),'Entry assets must be under /assets/');
    entries.add(url.pathname+url.search);
  }
  const assets = [...entries].sort();
  assert.ok(assets.some(a=>/\.js(?:\?|$)/.test(a)), 'HTML must contain a JavaScript entry');
  assert.ok(assets.some(a=>/\.css(?:\?|$)/.test(a)), 'HTML must contain a CSS entry');
  return assets;
}

export async function auditPublicRelease({origin='https://mgx-poker.com',expectedCommit,sourceCommit,cwd=ROOT,portraitNames,fetchImpl=fetch} = {}) {
  const report = {verifiedAt:new Date().toISOString(),status:'FAIL',sourceCommit:sourceCommit??null,publishedCommit:null,assets:[],portraits:[],requests:[],issues:[]};
  try {
    const target = new URL(origin);
    assert.ok(['https:','http:'].includes(target.protocol) && !target.username && !target.password && target.pathname==='/' && !target.search && !target.hash, 'An HTTP(S) origin without credentials or a path is required');
    report.origin = target.origin;
    const get = async path => {
      const url = new URL(path,target.origin);
      url.searchParams.set('mgxAudit',report.verifiedAt);
      const response = await fetchImpl(url,{signal:AbortSignal.timeout(20000),redirect:'error',headers:{'Cache-Control':'no-cache'}});
      report.requests.push({path,status:response.status,contentType:response.headers.get('content-type')});
      assert.equal(response.status,200,`${path}: HTTP ${response.status}`);
      return response;
    };
    const release = await (await get('/release.json')).json();
    assert.match(release.commit ?? '',SHA,'Published metadata must contain a full commit SHA');
    report.publishedCommit = release.commit;
    report.release = release;
    if (expectedCommit != null) {
      assert.match(expectedCommit,SHA,'Expected release must be a full commit SHA');
      assert.equal(release.commit,expectedCommit,'Published release must match expected commit');
    }
    if (sourceCommit != null) {
      report.unpublishedRuntimePaths = findUnpublishedRuntimePaths({cwd,publishedCommit:release.commit,sourceCommit});
      assert.deepEqual(report.unpublishedRuntimePaths,[],'Application changes have not been published');
    }
    const html = await (await get('/')).text();
    report.assets = readHtml(html,release.commit,target.origin);
    for (const path of report.assets) {
      const response = await get(path);
      const type = response.headers.get('content-type') ?? '';
      if (/\.js(?:\?|$)/.test(path)) assert.match(type,/(?:java|ecma)script/i,`${path}: JavaScript content type required`);
      else assert.match(type,/text\/css/i,`${path}: CSS content type required`);
      const body = await response.text();
      assert.ok(body.trim() && !/^\s*(?:<!doctype\s+html|<html)/i.test(body),`${path}: asset must not be an HTML fallback`);
    }
    for (const route of ROUTES) {
      const body = await (await get(route)).text();
      assert.deepEqual(readHtml(body,release.commit,target.origin),report.assets,`${route}: entries must match the home page`);
    }
    const names = portraitNames ?? (await readdir(resolve(cwd,'public/characters'))).filter(name=>name.endsWith('.png')).sort();
    assert.ok(names.length>0,'At least one opponent portrait is required');
    for (const name of names) {
      assert.match(name,/^[\w-]+\.png$/,'Portrait must be a PNG basename');
      const response = await get(`/characters/${name}`);
      assert.match(response.headers.get('content-type') ?? '',/image\/png/i,'PNG content type required');
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.ok(bytes.length>=24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16)==='IHDR' && bytes.readUInt32BE(16)>0 && bytes.readUInt32BE(20)>0,`${name}: valid PNG header and dimensions required`);
      report.portraits.push(name);
    }
    report.health = await (await get('/api/health')).json();
    assert.equal(report.health.status,'ok','API must be healthy');
    assert.equal(report.health.env,'prod','API must identify production');
    assert.equal(report.health.db,'ok','Production database must be healthy');
    const finalRelease = await (await get('/release.json')).json();
    assert.equal(finalRelease.commit,release.commit,'Release changed during verification; rerun against the completed deployment');
    report.status = 'PASS';
  } catch (error) {
    report.issues.push(error.message);
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const {values} = parseArgs({options:{origin:{type:'string'},'expected-commit':{type:'string'},'source-commit':{type:'string'},report:{type:'string',default:'reports/production-release/audit.json'}}});
  const report = await auditPublicRelease({origin:values.origin,expectedCommit:values['expected-commit'],sourceCommit:values['source-commit']});
  const path = resolve(values.report);
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path,JSON.stringify(report,null,2)+'\n');
  process.stdout.write(`[MGX release audit] ${JSON.stringify({status:report.status,publishedCommit:report.publishedCommit,sourceCommit:report.sourceCommit,requests:report.requests.length,portraits:report.portraits.length,issues:report.issues,report:path})}\n`);
  if (report.status!=='PASS') process.exitCode=1;
}
