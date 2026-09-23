import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {connectDevice} from './iphone-client.mjs';
import {openPhysicalVariant} from './physical-layout.mjs';
import {clickDeviceId} from './physical-features.mjs';
const c=await connectDevice();
const rows=[];const report={device:'physical iPhone Safari',interaction:'DOM activation of visible controls; short tournament config only, no forced outcomes',variant:process.env.MGX_BUST_VARIANT??'nlh',rows};
const out=new URL(`../adoption-implementation/portraits-tournament-2026-09-23/physical-${report.variant}.json`,import.meta.url);
const save=()=>writeFile(out,JSON.stringify(report,null,2));
try{
 await c.start();await openPhysicalVariant(c,report.variant==='badugi'?'badugi':'nlh',report.variant==='badugi'?'D03':'B01');
 await c.evaluate(variant=>window.__BADUGI_E2E__.startTournamentMTT({id:`physical-bust-${variant}`,name:'実機・敗退と卓統合確認',practiceOnly:true,tables:3,seatsPerTable:6,totalPlayers:18,startingStack:500,gameVariant:variant,gameRotation:[variant],rotationPolicy:'fixed',levels:[{levelIndex:1,smallBlind:5,bigBlind:10,ante:0,handsThisLevel:999}],payouts:[{place:1,percent:50},{place:2,percent:30},{place:3,percent:20}]}),report.variant);
 await c.until(()=>window.__BADUGI_E2E__.getTournamentHudState()?.playersRemaining===18);
 report.viewport=await c.evaluate(()=>[innerWidth,innerHeight]);
 let current='',actions=[],lastCompleted='',seenFinal=false;
 const deadline=Date.now()+20*60*1000;
 while(Date.now()<deadline&&rows.length<80){
  const s=await c.evaluate(()=>{const api=window.__BADUGI_E2E__;const state=api.getStateSnapshot();return {handId:state.handId,hud:api.getTournamentHudState(),terminal:!!document.querySelector('[data-testid=mtt-hero-bust-overlay],[data-testid=mtt-result-overlay]'),result:!!document.querySelector('[data-testid=hand-result-overlay]'),available:['action-check','action-call','action-fold','action-draw-selected','action-raise'].filter(id=>{const e=document.querySelector(`[data-testid="${id}"]`);return e&&!e.disabled&&e.getClientRects().length;}),saved:JSON.parse(localStorage.getItem('mgx.tournament.mtt.active'))?.tournamentState};});
  if(s.handId!==current){current=s.handId;actions=[];}
  if(s.terminal){assert.equal(s.result,false,'Hand result must not cover the tournament result');report.terminal={hud:s.hud,placements:await c.evaluate(()=>window.__BADUGI_E2E__.getTournamentPlacements()),review:await c.evaluate(()=>window.__BADUGI_E2E__.getTournamentReview())};await c.shot(`bust-${report.variant}-terminal`);const places=report.terminal.placements;assert.equal(places.length,18);assert.equal(new Set(places.map(p=>p.place)).size,18);assert.equal(places.reduce((n,p)=>n+p.stack,0),9000);assert.equal(places.reduce((n,p)=>n+p.payout,0),s.hud.prizePoolTotal);await c.click('Back to Menu','[data-testid=mtt-hero-bust-overlay],[data-testid=mtt-result-overlay]');await c.until(()=>!!document.querySelector('[data-testid=menu-ring]'));report.returnedToMenu=true;report.status='PASS';break;}
  if(s.result&&s.handId!==lastCompleted){
   lastCompleted=s.handId;const t=s.saved;assert.ok(t);
   const players=Object.values(t.players);const tables=t.tables.filter(t=>t.isActive);const ids=tables.flatMap(t=>t.seats.map(s=>s.playerId).filter(Boolean));
   assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,t.playersRemaining);
   assert.equal(players.reduce((n,p)=>n+p.stack,0),9000);
   for(const p of players){if(p.busted){assert.equal(p.stack,0);assert.ok(p.finishPlace);assert.ok(!ids.includes(p.id));}else assert.ok(ids.includes(p.id));}
   assert.equal(t.players['hero-player'].tableId,'table-1');
   const row={handId:s.handId,actions:[...actions],remaining:t.playersRemaining,tables:tables.length,heroStack:t.players['hero-player'].stack,busted:players.filter(p=>p.busted).map(p=>({id:p.id,name:p.name,place:p.finishPlace})),events:t.events};rows.push(row);console.log(JSON.stringify({hand:rows.length,remaining:row.remaining,tables:row.tables,hero:row.heroStack,actions:actions.length}));
   if(rows.length===1||rows.at(-2)?.tables!==row.tables){await c.shot(`bust-${report.variant}-${row.tables}-tables`);row.state=t;}
   if(row.tables===1)seenFinal=true;
   await save();await clickDeviceId(c,'hand-result-next-hand');
   continue;
  }
  if(s.available.length&&!s.result){
   let id;
   if(!seenFinal)id=s.available.includes('action-fold')?'action-fold':s.available[0];
   else id=s.available.includes('action-raise')?'action-raise':s.available[0];
   await clickDeviceId(c,id);actions.push(id);
   if(id==='action-raise'){
    const panel=await c.evaluate(()=>!!document.querySelector('[data-testid=bet-amount-sheet]'));
    if(panel){await c.until(()=>{const buttons=[...document.querySelectorAll('.mgx-amount-presets button')];const max=buttons.sort((a,b)=>Number(b.querySelector('strong').textContent)-Number(a.querySelector('strong').textContent))[0];if(!max)return false;max.click();return true;});await clickDeviceId(c,'bet-amount-confirm');actions.push('maximum-raise');}
   }
  }
  await new Promise(r=>setTimeout(r,150));
 }
 if(!report.status)throw Error('Tournament did not finish within limit');
 report.sawThreeToTwo=rows.some(r=>r.tables===2);report.sawFinalTable=seenFinal;
}catch(e){report.status='FAIL';report.error=String(e);console.error(e);try{await c.shot(`bust-${report.variant}-failure`);report.failureState=await c.evaluate(()=>({state:window.__BADUGI_E2E__?.getStateSnapshot(),hud:window.__BADUGI_E2E__?.getTournamentHudState(),text:document.body.innerText}));}catch{}}
finally{await save();await c.close();}
