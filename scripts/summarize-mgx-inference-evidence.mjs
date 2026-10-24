import {readFile, readdir, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve, dirname} from 'node:path';
import {parseArgs} from 'node:util';
import {GAME_VARIANTS} from '../src/games/config/variantCatalog.js';
import {normalizeAppVariantId} from '../src/ui/game/appVariantRouting.js';

const {values} = parseArgs({options:{input:{type:'string'},output:{type:'string'},'source-commit':{type:'string'}}});
if (!values.input || !values.output || !/^[a-f0-9]{40}$/.test(values['source-commit'] ?? '')) throw Error('input, output and full tested source-commit are required');
const git = args => execFileSync('git',args,{encoding:'utf8'}).trim();
git(['cat-file','-e',`${values['source-commit']}^{commit}`]);
const runtimeDiff = git(['diff','--name-only',values['source-commit'],'HEAD','--','src','public','package.json','package-lock.json']);
if (runtimeDiff) throw Error(`Runtime differs from tested source: ${runtimeDiff}`);
const dirtyRuntime = git(['status','--porcelain','--','src','public','package.json','package-lock.json']);
if (dirtyRuntime) throw Error('Uncommitted runtime changes prevent source attribution');
async function files(directory) {
  const found=[];
  for (const item of await readdir(directory,{withFileTypes:true})) {
    const path=resolve(directory,item.name);
    if(item.isDirectory()) found.push(...await files(path));
    else if(item.name==='inference-evidence.json') found.push(path);
  }
  return found;
}
const rows=[];
for (const file of (await files(resolve(values.input))).sort()) {
  const bytes=await readFile(file), evidence=JSON.parse(bytes);
  const appId=normalizeAppVariantId(evidence.variant,null);
  const variant=GAME_VARIANTS.find(v=>normalizeAppVariantId(v.engineKey??v.id,null)===appId);
  if(!variant || !Array.isArray(evidence.rows)) throw Error(`Unknown evidence shape: ${file}`);
  const tier=evidence.tier ?? evidence.rows[0]?.tierId;
  const phases=['triple-draw','single-draw','dramaha'].includes(variant.category)?['BET','DRAW']:['BET'];
  const counts={}, models=new Set(), reasons=new Set();
  for(const decision of evidence.rows) {
    if(decision.tierId!==tier || !Number.isFinite(decision.elapsedMs) || decision.elapsedMs<0) throw Error(`Invalid decision attribution: ${file}`);
    counts[decision.status]=(counts[decision.status]??0)+1;
    if(decision.usedModelId) models.add(decision.usedModelId);
    if(decision.reason) reasons.add(decision.reason);
  }
  rows.push({variantId:variant.id,appVariantId:appId,tier,phases,
    observedPhases:[...new Set(evidence.rows.map(row=>row.phase))],
    phaseCoverage:phases.every(phase=>evidence.rows.some(row=>row.phase===phase)),
    decisionCount:evidence.rows.length,statusCounts:counts,usedModels:[...models],reasons:[...reasons],
    errors:evidence.errors??[],apiStubbed:evidence.apiStubbed===true,
    evidenceFile:file,evidenceSha256:createHash('sha256').update(bytes).digest('hex')});
}
const keys=rows.map(row=>`${row.variantId}:${row.tier}`);
if(new Set(keys).size!==keys.length) throw Error('Duplicate variant/tier evidence; choose one run directory');
const report={generatedAt:new Date().toISOString(),sourceCommit:values['source-commit'],
  scope:'Local browser inference samples. This is not proof of model strength, physical QA, production use, or complete-hand quality.',
  rowCount:rows.length,phaseCoveredRows:rows.filter(row=>row.phaseCoverage).length,
  allRecordedDecisionsUsedModelRows:rows.filter(row=>row.decisionCount>0&&row.statusCounts.used===row.decisionCount).length,
  rows};
await mkdir(dirname(resolve(values.output)),{recursive:true});
await writeFile(values.output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({rowCount:report.rowCount,phaseCoveredRows:report.phaseCoveredRows,allRecordedDecisionsUsedModelRows:report.allRecordedDecisionsUsedModelRows}));
