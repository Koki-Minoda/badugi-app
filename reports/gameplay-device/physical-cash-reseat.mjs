import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {connectDevice} from './iphone-client.mjs';
import {openPhysicalVariant} from './physical-layout.mjs';
import {clickDeviceId} from './physical-features.mjs';
const c=await connectDevice();const report={interaction:'physical Safari, controlled post-settlement cash fixture followed by ten hands using visible next/fold controls',rows:[]};
try {
 await c.start();await openPhysicalVariant(c,'badugi','D03');
 await c.evaluate(()=>window.__BADUGI_E2E__.setupCashRebuyTerminalFixtureForTest());
 await c.until(()=>!!document.querySelector('[data-testid=hand-result-overlay]'));
 const original=await c.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot().handCount);
 for(let offset=1;offset<=10;offset++){
  await clickDeviceId(c,'hand-result-next-hand');
  await c.until(n=>window.__BADUGI_E2E__.getStateSnapshot().handCount===n,original+offset);
  const row=await c.evaluate(()=>{const s=window.__BADUGI_E2E__.getStateSnapshot();const image=document.querySelector('[data-testid=seat-1] .mgx-seat-avatar img');return {hand:s.handCount,player:s.players[1],cards:s.controllerSnapshot.players[1].hand,portraitLoaded:!!image&&image.complete&&image.naturalWidth>0,text:document.querySelector('[data-testid=seat-1]').innerText};});
  report.rows.push(row);assert.equal(row.player.seatOut,offset<10);
  if(offset<10){assert.equal(row.player.stack,0);assert.equal(row.cards.length,0);assert.ok(row.text.includes('離席'));}
  else {assert.ok(row.player.stack>0);assert.equal(row.cards.length,4);assert.equal(row.portraitLoaded,true);}
  if(offset===1||offset===10)await c.shot(`cash-reseat-${offset}`);
  if(offset<10){await clickDeviceId(c,'action-fold');await c.until(()=>!!document.querySelector('[data-testid=hand-result-overlay]'));}
 }
 report.errors=c.errors;assert.equal(c.errors.length,0);report.status='PASS';
}catch(e){report.status='FAIL';report.error=String(e);}
finally{await writeFile(new URL('../adoption-implementation/portraits-tournament-2026-09-23/physical-cash-reseat.json',import.meta.url),JSON.stringify(report,null,2));await c.close();console.log(report.status,report.error??'');}
