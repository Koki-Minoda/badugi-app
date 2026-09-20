import assert from 'node:assert/strict';
import {readSettledPhaseTone} from './phase-tone-check.mjs?settled=2';
import {measureMobileLayout} from './mobile-layout-check.mjs';
import {writeFile} from 'node:fs/promises';
export async function clickDeviceId(c,id){
 return c.until(id=>{const e=document.querySelector(`[data-testid="${id}"]`);if(!e||e.disabled||!e.getClientRects().length)return false;const b=e.getBoundingClientRect();if(b.top<0||b.bottom>innerHeight)e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(!hit||!e.contains(hit))return false;e.click();return true;},id);
}
export async function playDeviceHand(c,{checkLayout=false}={}){
 const actions=[],phaseTransitions=[];let lastDraw='';const end=Date.now()+180000;
 while(Date.now()<end){
  const s=await c.evaluate(()=>{const st=window.__BADUGI_E2E__?.getStateSnapshot?.();return {handId:st?.handId,round:st?.drawRoundIndex??st?.drawRound,result:!!document.querySelector('[data-testid=hand-result-overlay]'),actions:['action-check','action-call','action-draw-selected','action-raise'].filter(id=>{const e=document.querySelector(`[data-testid="${id}"]`);return e&&!e.disabled&&e.getClientRects().length;})};});
  if(s.result){assert.ok(actions.length);return {handId:s.handId,actions,phaseTransitions};}
  if(checkLayout){assert.deepEqual((await c.evaluate(measureMobileLayout)).issues,[]);const tone=await readSettledPhaseTone(c);if(tone.issues.length){const diagnostic=await c.evaluate(()=>({snapshot:window.__BADUGI_E2E__?.getStateSnapshot?.(),text:document.body.innerText}));await c.shot('phase-feature-mismatch');throw Error(JSON.stringify({tone,diagnostic}));}if(phaseTransitions.at(-1)?.phase!==tone.phase)phaseTransitions.push(tone);}
  const a=s.actions[0];if(a){const key=`${s.handId}:${s.round}`;if(a==='action-draw-selected'&&lastDraw!==key){await clickDeviceId(c,'player-0-card-0');lastDraw=key;}await clickDeviceId(c,a);actions.push(a);}
  await new Promise(r=>setTimeout(r,250));
 }
 throw Error('Physical hand timed out');
}
export async function auditPhysicalFeatures(c,{outputName='physical-features-final',checkLayout=false,formats=['stage','survival','championship']}={}){
 const rows=[];const save=()=>writeFile(new URL(`./artifacts/${outputName}.json`,import.meta.url),JSON.stringify({updated:new Date().toISOString(),interaction:'physical Safari with DOM control activation; local test career unlock; no forced result',rows},null,2));
 await c.evaluate(()=>{localStorage.setItem('mgx.tournament.v2',JSON.stringify({version:2,tournament:{bankroll:0,stageWins:{store:0,local:0,national:0,world:0},completedTournaments:[],history:[],lastResult:null},career:{statistics:{},worldChampionship:{cleared:true}},rivals:{},_meta:{}}));});
 for(const format of formats){
  const row={id:format,status:'RUNNING'};rows.push(row);await save();
  try{
   await c.navigate('/multigame');
   await c.evaluate(()=>{localStorage.removeItem('mgx.multiGameSeries.v1');localStorage.removeItem('mgx.tournament.mtt.active');localStorage.removeItem('session.tournament.active');});
   await c.navigate('/multigame');await clickDeviceId(c,`multi-format-${format}`);
   for(let i=0;i<3;i++)await c.field(`${i+1}種目目`,['badugi','nlh','stud'][i]);
   await clickDeviceId(c,'multi-start');await c.until(()=>!!window.__BADUGI_E2E__?.getStateSnapshot?.()?.handId);
   row.play=await playDeviceHand(c,{checkLayout});await c.shot(`${outputName}-multi-${format}-result`);
   row.saved=await c.until(()=>{const s=JSON.parse(localStorage.getItem('mgx.tournament.mtt.active'));return s?.config?.multiGame?{id:s.config.id,format:s.config.multiGame.format}:false;},undefined,10000);assert.equal(row.saved.format,format);
   await c.navigate('/multigame');await clickDeviceId(c,'multi-continue');await c.until(()=>window.__BADUGI_E2E__?.getStateSnapshot?.()?.phase==='WAITING_NEXT_HAND');
   await c.until(()=>{const e=[...document.querySelectorAll('button')].find(e=>/次のハンド|Next Hand/i.test(e.textContent)&&!e.disabled&&e.getClientRects().length);if(!e)return false;e.click();return true;});await c.until(()=>!!window.__BADUGI_E2E__?.getStateSnapshot?.()?.handId);row.resumedPlay=await playDeviceHand(c,{checkLayout});
   assert.equal(await c.evaluate(()=>JSON.parse(localStorage.getItem('mgx.tournament.mtt.active'))?.config?.id),row.saved.id);row.resumed=true;row.status='PASS';
  }catch(e){row.status='FAIL';row.error=String(e);}
  await save();
 }
 const row={id:'dealers-choice',status:'RUNNING',hands:[]};rows.push(row);await save();
 try{
  await c.evaluate(()=>{localStorage.removeItem('dealersChoice.queue');localStorage.removeItem('mgx.tournament.mtt.active');localStorage.removeItem('session.tournament.active');});
  await c.navigate('/dealers-choice');await c.field('遊ぶ種目','B01');await clickDeviceId(c,'roulette-add');await c.field('遊ぶ種目','D03');await clickDeviceId(c,'roulette-add');await clickDeviceId(c,'roulette-launch');
  await c.until(()=>window.__BADUGI_E2E__?.getStateSnapshot?.()?.gameVariant==='nlh');row.hands.push(await playDeviceHand(c,{checkLayout}));await clickDeviceId(c,'hand-result-next-hand');
  await c.until(()=>window.__BADUGI_E2E__?.getStateSnapshot?.()?.gameVariant==='badugi');row.hands.push(await playDeviceHand(c,{checkLayout}));assert.deepEqual(await c.evaluate(()=>JSON.parse(localStorage.getItem('dealersChoice.queue'))),[]);await c.shot(`${outputName}-dealer-choice-result`);row.status='PASS';
 }catch(e){row.status='FAIL';row.error=String(e);}await save();return rows;
}
