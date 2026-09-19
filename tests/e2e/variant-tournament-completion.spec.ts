import {test,expect} from '@playwright/test';
import {VARIANT_AVAILABILITY} from '../../src/games/config/variantAvailability.js';
import {APP_URL,openAuthenticatedGame,deleteAuthenticatedSession} from './authHelper';
import {playOneHandProgression} from './helpers/gameProgressHelper.js';
import {fastForwardTournamentComplete,returnTournamentOverlayToMenu} from './helpers/core5LifecycleE2EHelper';
for(const [id,v] of Object.entries(VARIANT_AVAILABILITY))if(!['ofc','chinese_poker'].includes(id)&&v.availability!=='coming_soon')test(`${id}: tournament hand, placement and return`,async({page},info)=>{
 if(v.availability==='preview_only')await page.addInitScript(()=>localStorage.setItem('mgx.previewVariants','true'));
 const session=await openAuthenticatedGame(page,`${APP_URL}?variant=${id}`);
 try{
  await page.evaluate(variant=>(window as any).__BADUGI_E2E__.startTournamentMTT({id:`variant-${variant}`,name:'Variant QA',tables:1,seatsPerTable:6,startingStack:2000,gameVariant:variant,gameRotation:[variant],rotationPolicy:'fixed',levels:[{levelIndex:1,smallBlind:25,bigBlind:50,ante:0,handsThisLevel:999}],payouts:[{place:1,percent:100}]}),id);
  await expect(page.getByTestId('tournament-hud')).toBeVisible();
  const hand=await playOneHandProgression(page,{maxSteps:220,policy:'heroStay',requireHeroButtonClick:true,requireDrawVisit:id.includes('draw')});expect(hand.status).toBe('PASS');
  await fastForwardTournamentComplete(page);
  const placements=await page.evaluate(()=>(window as any).__BADUGI_E2E__.getTournamentPlacements());expect(placements).toHaveLength(6);expect(placements.filter((p:any)=>p.place===1)).toHaveLength(1);
  await info.attach('completion',{body:JSON.stringify({id,hand:{phases:hand.visitedPhases,clicks:hand.heroButtonClicks},placements}),contentType:'application/json'});
  await returnTournamentOverlayToMenu(page);
 }finally{await deleteAuthenticatedSession(page,session);}
});
