import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CORE_GAMES, RELEASE_GATES } from './v1-core-contract.mjs';
import { TOURNAMENT_VARIANTS } from '../../src/config/tournamentUnlocks.js';
const soakPath='reports/release-v1/engine-soak-20261102.json';
const soak=fs.existsSync(soakPath)?JSON.parse(fs.readFileSync(soakPath,'utf8')):null;
const offered=new Set(TOURNAMENT_VARIANTS.map(v=>v.gameVariant));
// Verified in FriendMatchSetupScreen and backend/app/api/p2p.py on the audited base.
const p2pSupported=new Set(['D01','D02','D03']);
const records=CORE_GAMES.flatMap(game=>['cash','tournament','mix','p2p'].flatMap(mode=>Object.entries(RELEASE_GATES).map(([gate,name])=>({
  variantId:game.id,appId:game.appId,game:game.name,mode,gate,name,
  state:mode==='p2p'&&!p2pSupported.has(game.id)?'not_applicable':mode==='cash'&&gate==='G1'&&soak?'partial':'not_verified',
  exposure:mode==='p2p'?(p2pSupported.has(game.id)?'ui-and-api-listed':'api-rejects-unsupported-variant'):mode==='mix'?'catalog-menu-listed':mode==='cash'?'public-catalog':mode==='tournament'&&offered.has(({D03:'badugi',D01:'D01',D02:'D02'})[game.id]??game.appId)?'career-menu-listed':'requires-route-audit',
  evidence:mode==='cash'&&gate==='G1'&&soak?[{path:soakPath,scope:soak.scope,
    sampledHands:soak.rows.filter(row=>row.id===game.id).reduce((sum,row)=>sum+row.completed,0),
    result:soak.rows.filter(row=>row.id===game.id).every(row=>row.status==='PASS')?'sampled-pass':'fail'}]:[],
  sourceCommit:soak?.sourceCommit??null,servedCommit:null,
  remainingFindings:mode==='cash'&&gate==='G1'?['Independent sampled passive hands do not close the full game gate','Browser continuity, edge actions, independent oracle and physical-device evidence required']:['Evidence must be recorded for this exact scope'],
}))));
const output='reports/release-v1/ledger.json';fs.mkdirSync('reports/release-v1',{recursive:true});
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),
  sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  statusSource:'https://github.com/Koki-Minoda/badugi-app/issues/123',releaseGatePassed:false,records},null,2)+'\n');
process.stdout.write(`${records.length} scoped gate records written; no release gate certified\n`);
