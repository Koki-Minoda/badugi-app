import {writeFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {APP_URL,openAuthenticatedGame,deleteAuthenticatedSession} from './authHelper';
import {playOneHandProgression} from './helpers/gameProgressHelper.js';
const measure=()=>{
    const ids=['game-table-surface','seat-0','seat-1','seat-2','seat-3','seat-4','seat-5','decision-panel','table-total-pot','player-action-hint','action-setting-slot','action-buttons-slot','action-fold','action-raise'];
    const metrics=Object.fromEntries(ids.map(id=>{const e=document.querySelector(`[data-testid="${id}"]`),r=e?.getBoundingClientRect(),s=e?getComputedStyle(e):null;return [id,r?{x:r.x,y:r.y,w:r.width,h:r.height,font:s.fontSize,radius:s.borderRadius}:null];}));
    for(const id of ['player-0-card-0','player-1-card-0']){const e=document.querySelector(`[data-testid="${id}"]`),r=e.getBoundingClientRect(),s=getComputedStyle(e);metrics[id]={w:r.width,h:r.height,font:s.fontSize,radius:s.borderRadius};}
    return metrics;
   };
for(const viewport of [{width:393,height:695},{width:852,height:283},{width:320,height:568}])test(`NLH and 2-7 share the same table ${viewport.width}`,async({page},info)=>{
 await page.setViewportSize(viewport);
 const layouts=[];
 for(const variant of ['nlh','deuce_to_seven_triple_draw','deuce_to_seven_single_draw']){
  const session=await openAuthenticatedGame(page,`${APP_URL}?variant=${variant}`);
  try{
   await expect(page.getByTestId('seat-0')).toBeVisible();
   await page.screenshot({path:info.outputPath(`${variant}.png`)});
   const baseline=await page.evaluate(measure);layouts.push(baseline);
   if(!process.env.MGX_CAPTURE_COMPARISON){
    const result=await playOneHandProgression(page,{maxSteps:200,policy:'heroStay',requireHeroButtonClick:true,requireDrawVisit:variant!=='nlh',onStep:async({progress})=>{if(progress.isTerminal)return;const now=await page.evaluate(measure);expect(now).toEqual(baseline);}});expect(result.status).toBe('PASS');
   }
  }finally{await deleteAuthenticatedSession(page,session);}
 }
 await writeFile(info.outputPath('layout-comparison.json'),JSON.stringify({viewport,variants:['nlh','deuce_to_seven_triple_draw','deuce_to_seven_single_draw'],layouts},null,2));
 await info.attach('layout-comparison',{body:JSON.stringify(layouts,null,2),contentType:'application/json'});
 if(!process.env.MGX_CAPTURE_COMPARISON){
  for(const layout of layouts.slice(1))for(const [id,metric] of Object.entries(layouts[0]))expect(layout[id],`${id} must not move or change styling between games`).toEqual(metric);
 }
});
