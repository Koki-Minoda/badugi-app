import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateCoachQuality, COACH_QUALITY_THRESHOLDS } from '../../src/ui/coaching/coachQualityGate.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/release/coach-candidates.json'),'utf8'));
function verify(ref){
  if(!ref?.path || !/^[a-f0-9]{64}$/.test(ref.sha256??''))return false;
  const target=path.resolve(root,ref.path);
  if(!target.startsWith(root))return false;
  try{return createHash('sha256').update(fs.readFileSync(target)).digest('hex')===ref.sha256;}catch{return false;}
}
const rows=manifest.candidates.map(c=>({id:c.id,limitations:c.limitations,
  ...evaluateCoachQuality({...c,evidenceVerified:verify(c.evidence)&&verify(c.independentReview?.evidence)},c.request)}));
const output=path.join(root,'reports/release-v1/coach-audit.json');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify({generatedAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),thresholds:COACH_QUALITY_THRESHOLDS,rows,releaseGatePassed:false},null,2)+'\n');
process.stdout.write(`${rows.length} candidates audited; ${rows.filter(r=>r.eligible).length} eligible. ${output}\n`);
