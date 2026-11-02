import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_GAMES, CORE_QA_TARGETS } from './v1-core-contract.mjs';

export function summarizeV1BrowserEvidence({root,expectedCommit,minimumHands=CORE_QA_TARGETS.browserHandsPerProfile}={}) {
  if(!root || !/^[a-f0-9]{40}$/.test(expectedCommit??''))throw new Error('Evidence root and exact expected commit are required');
  const rows=[];
  for(const game of CORE_GAMES)for(const device of CORE_QA_TARGETS.browserProfiles){
    const qaId=['D01','D02','S01'].includes(game.id)?game.id:game.appId;
    const file=path.join(root,`browser-${device}-root`,`${qaId.toLowerCase()}-${device}-${minimumHands}-hands.json`);
    if(!fs.existsSync(file)){rows.push({id:game.id,device,status:'NOT_VERIFIED',reason:'Complete report missing'});continue;}
    let r;
    try{r=JSON.parse(fs.readFileSync(file,'utf8'));}catch{rows.push({id:game.id,device,status:'FAIL',reason:'Invalid report'});continue;}
    const checks={status:r.status==='PASS',identity:r.variant===qaId&&r.device===device,
      release:r.servedCommit===expectedCommit,hands:r.handsCompleted>=minimumHands,
      nextHand:r.nextHandClicks>=minimumHands-1,heroActions:r.totalHeroButtonClicks>=minimumHands/2,
      history:r.history?.records>=minimumHands,cashOut:r.cashOut===true,
      rows:Array.isArray(r.rows)&&r.rows.length>=minimumHands,
      browser:r.browserEngine===(device==='iphone'?'webkit':'chromium')};
    const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
    rows.push({id:game.id,device,status:failures.length?'FAIL':'PASS_BROWSER_SCOPE',failures,
      hands:r.handsCompleted,servedCommit:r.servedCommit,path:file});
  }
  return {schemaVersion:1,generatedAt:new Date().toISOString(),expectedCommit,minimumHands,expectedCases:rows.length,
    completedCases:rows.filter(r=>r.status==='PASS_BROWSER_SCOPE').length,
    status:rows.some(r=>r.status==='FAIL')?'FAIL':rows.every(r=>r.status==='PASS_BROWSER_SCOPE')?'PASS_BROWSER_SCOPE':'INCOMPLETE',
    releaseGatePassed:false,remaining:['120-minute continuous sessions','Tournament matrix','Independent winner fixtures and strategic review','Physical iPhone and Android'],rows};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const expectedCommit=process.argv[2];
  const root='reports/release-v1';
  const summary=summarizeV1BrowserEvidence({root,expectedCommit});
  fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'browser-summary.json'),JSON.stringify(summary,null,2)+'\n');
  process.stdout.write(`${summary.status}: ${summary.completedCases}/${summary.expectedCases}\n`);
  process.exitCode=summary.status==='PASS_BROWSER_SCOPE'?0:1;
}
