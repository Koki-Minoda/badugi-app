import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {openPhysicalVariant} from './physical-layout.mjs';
export async function comparePhysicalFamilies(c,{outputName='family'}={}){
 const rows=[];
 for(const [id,profile] of [['nlh','B01'],['deuce_to_seven_triple_draw','D01'],['deuce_to_seven_single_draw','S01']]){
  await openPhysicalVariant(c,id,profile);
  await c.until(()=>['action-call','action-check'].some(id=>{const e=document.querySelector(`[data-testid=${id}]`);return e&&!e.disabled;}));
  const metrics=await c.evaluate(()=>{
   const dimensions=id=>{const e=document.querySelector(`[data-testid=${id}]`),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
   const boxes=Object.fromEntries(['game-table-surface','seat-0','seat-1','seat-2','seat-3','seat-4','seat-5','decision-panel','table-total-pot','player-action-hint','action-setting-slot','action-buttons-slot'].map(id=>[id,dimensions(id)]));
   const cards=Object.fromEntries(['player-0-card-0','player-1-card-0'].map(id=>{const {w,h}=dimensions(id);return [id,{w,h}];}));
   return {viewport:{width:innerWidth,height:innerHeight},boxes,cards};
  });
  await c.shot(`${outputName}-verified-${id}`);rows.push({id,metrics});
 }
 for(const row of rows.slice(1))assert.deepEqual(row.metrics,rows[0].metrics);
 await writeFile(new URL(`./artifacts/${outputName}-physical-comparison.json`,import.meta.url),JSON.stringify({updated:new Date().toISOString(),status:'PASS',interaction:'Physical Safari DOM controls',rows},null,2));
 return {status:'PASS',ids:rows.map(r=>r.id),viewport:rows[0].metrics.viewport};
}
