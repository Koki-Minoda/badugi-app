import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {clickDeviceId} from './physical-features.mjs';
import {openPhysicalVariant} from './physical-layout.mjs';
export async function auditPhysicalKeypad(c,{outputName='phase-physical-keypad'}={}){
 await openPhysicalVariant(c,'nlh','B01');
 await clickDeviceId(c,'bet-size-input');
 const before=await c.evaluate(()=>{const s=window.__BADUGI_E2E__.getStateSnapshot();return {stack:s.controllerSnapshot?.players?.[0]?.stack??s.players[0].stack,viewport:[innerWidth,innerHeight]};});
 await clickDeviceId(c,'bet-key-8');await clickDeviceId(c,'bet-key-8');await clickDeviceId(c,'bet-key-back');await clickDeviceId(c,'bet-key-0');
 assert.equal(await c.evaluate(()=>document.querySelector('[data-testid=bet-amount-value]').textContent),'80');
 const geometry=await c.evaluate(()=>[...document.querySelectorAll('[data-testid^=bet-key-]')].map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.testid,width:r.width,height:r.height,visible:r.top>=0&&r.bottom<=innerHeight,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
 assert.ok(geometry.every(r=>r.width>=44&&r.height>=44&&r.visible&&r.hit));
 assert.equal(await c.evaluate(()=>{const s=window.__BADUGI_E2E__.getStateSnapshot();return s.controllerSnapshot?.players?.[0]?.stack??s.players[0].stack;}),before.stack);
 await c.shot(`${outputName}-80`);await clickDeviceId(c,'bet-amount-cancel');
 assert.equal(await c.evaluate(()=>!!document.querySelector('[data-testid=bet-amount-sheet]')),false);
 await clickDeviceId(c,'bet-size-input');await clickDeviceId(c,'bet-key-8');await clickDeviceId(c,'bet-key-0');await clickDeviceId(c,'bet-amount-confirm');
 await c.until(stack=>{const s=window.__BADUGI_E2E__.getStateSnapshot();return (s.controllerSnapshot?.players?.[0]?.stack??s.players[0].stack)===stack;},before.stack-80);
 const result={status:'PASS',method:'physical Safari DOM activation with hit tests, not native finger input',before,geometry,steps:['88 → delete → 80','no commitment before confirm','cancel closes without commitment','reopen, type 80 and confirm deducts exactly 80 chips']};
 await writeFile(new URL(`./artifacts/${outputName}.json`,import.meta.url),JSON.stringify(result,null,2));return result;
}
