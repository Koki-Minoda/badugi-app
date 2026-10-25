import {test,expect} from '@playwright/test';
import {APP_URL,openAuthenticatedGame,deleteAuthenticatedSession} from './authHelper';
import {playOneHandProgression} from './helpers/gameProgressHelper.js';
import {measureMobileLayout} from '../../reports/gameplay-device/mobile-layout-check.mjs';
import {measurePhaseTone} from '../../reports/gameplay-device/phase-tone-check.mjs';
for(const variant of ['badugi','deuce_to_seven_triple_draw','hidugi_triple_draw','badeucey_triple_draw','deuce_to_seven_single_draw','badugi_single_draw','badeucey_single_draw','badacey_single_draw','hidugi_single_draw','dramaha_hi'])for(const viewport of [{width:393,height:695},{width:852,height:283}])test(`${variant} ${viewport.width}: bet to draw to bet restores the rail`,async({page},info)=>{
 await page.setViewportSize(viewport);const session=await openAuthenticatedGame(page,`${APP_URL}?variant=${variant}`);
 try{
  const phases=[];let felt;
  const result=await playOneHandProgression(page,{maxSteps:200,policy:'heroStay',requireHeroButtonClick:true,requireDrawVisit:true,onStep:async({progress})=>{
   if(progress.isTerminal)return;
   const chrome=await page.evaluate(measurePhaseTone);expect(chrome.issues).toEqual([]);
   expect((await page.evaluate(measureMobileLayout)).issues).toEqual([]);
   felt??=chrome.felt;expect(chrome.felt).toBe(felt);
   if(phases.at(-1)!==chrome.phase){phases.push(chrome.phase);await page.screenshot({path:info.outputPath(`phase-${phases.length}-${chrome.phase}.png`)});}
  }});
  expect(result.status).toBe('PASS');
  const draw=phases.findIndex(p=>['DRAW','DRAWING'].includes(p));expect(draw).toBeGreaterThan(0);expect(phases.slice(draw+1)).toContain('BET');
 }finally{await deleteAuthenticatedSession(page,session);}
});
for(const variant of ['badugi','deuce_to_seven_triple_draw','hidugi_triple_draw','badeucey_triple_draw','badugi_single_draw','badeucey_single_draw','badacey_single_draw','hidugi_single_draw'])test(`desktop ${variant}: shared phase colors follow the controller`,async({page,isMobile},info)=>{
 test.skip(isMobile,'Desktop layout requires a desktop browser profile');
 await page.setViewportSize({width:1440,height:900});const session=await openAuthenticatedGame(page,`${APP_URL}?variant=${variant}`);const phases=[];
 try{
  const played=await playOneHandProgression(page,{maxSteps:200,policy:'heroStay',requireHeroButtonClick:true,requireDrawVisit:true,onStep:async({progress})=>{
   if(progress.isTerminal)return;
   const chrome=await page.evaluate(()=>{
    const s=window.__BADUGI_E2E__?.getStateSnapshot?.(),phase=s?.controllerSnapshot?.phase??s?.phase;
    const rail=document.querySelector('[data-testid=game-table-surface]'),felt=document.querySelector('[data-testid=table-felt-oval]');
    return {phase,tone:document.querySelector('[data-phase-tone]')?.getAttribute('data-phase-tone'),border:getComputedStyle(rail).borderTopColor,felt:getComputedStyle(felt).backgroundColor};
   });
   if(!['BET','DRAW','DRAWING'].includes(chrome.phase))return;
   const draw=chrome.phase!=='BET';expect(chrome.tone).toBe(draw?'draw':'bet');
   const rgb=chrome.border.match(/[\d.]+/g).map(Number);expect(rgb[0]>rgb[1]+40&&Math.abs(rgb[1]-rgb[2])<40).toBe(draw);
   const green=chrome.felt.match(/[\d.]+/g).map(Number);expect(green[1]).toBeGreaterThan(green[0]);
   if(phases.at(-1)!==chrome.phase){phases.push(chrome.phase);await page.screenshot({path:info.outputPath(`desktop-${phases.length}-${chrome.phase}.png`)});}
  }});expect(played.status).toBe('PASS');expect(phases).toContain('DRAW');expect(phases.slice(phases.indexOf('DRAW')+1)).toContain('BET');
 }finally{await deleteAuthenticatedSession(page,session);}
});
