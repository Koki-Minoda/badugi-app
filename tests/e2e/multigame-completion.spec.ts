import {measureMobileLayout} from '../../reports/gameplay-device/mobile-layout-check.mjs';
import {test,expect} from '@playwright/test';
import {APP_URL,createAuthenticatedSession,deleteAuthenticatedSession} from './authHelper';
import {playOneHandProgression,waitForE2EDriver} from './helpers/gameProgressHelper.js';
for(const format of ['stage','survival','championship'])test(`Multi-game ${format}: play, restore, finish and preserve career`,async({page},info)=>{
 test.setTimeout(300000);page.setDefaultTimeout(15000);
 const session=await createAuthenticatedSession(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(!localStorage.getItem('mgx.tournament.v2'))localStorage.setItem('mgx.tournament.v2',JSON.stringify({version:2,tournament:{bankroll:0,stageWins:{store:0,local:0,national:0,world:0},completedTournaments:[],history:[],lastResult:null},career:{statistics:{},worldChampionship:{cleared:true}},rivals:{},_meta:{}}));});
 try{
  await page.goto(`${APP_URL}multigame`);
  await page.getByTestId(`multi-format-${format}`).click();
  for(let i=0;i<3;i++)await page.getByRole('combobox',{name:`${i+1}種目目`,exact:true}).selectOption(['badugi','nlh','stud'][i]);
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.tournament.v2')!).tournament);
  const portrait=page.viewportSize()!.height>page.viewportSize()!.width;
  if(page.viewportSize()!.width<1000)await page.setViewportSize(portrait?{width:393,height:695}:{width:852,height:283});
  await page.getByTestId('multi-start').click();await waitForE2EDriver(page);
  for(let event=0;event<(format==='stage'?3:1);event++){
   await expect.poll(()=>page.evaluate(()=>(window as any).__BADUGI_E2E__?.getTournamentHudState()?.totalPlayers)).toBe(format==='stage'?6:18);
   const snap=await page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.tournament.mtt.active')!));
   expect(snap.config.multiGame.format).toBe(format);expect(snap.config.multiGame.stageIndex).toBe(event);
   const played=await playOneHandProgression(page,{maxSteps:180,policy:'heroStay',requireHeroButtonClick:true,onStep:async({progress})=>{if(!progress.isTerminal&&await page.getByTestId('mobile-play-layout').isVisible())expect((await page.evaluate(measureMobileLayout)).issues).toEqual([]);}});expect(played.status).toBe('PASS');
   // Reload restores the last completed hand through the same menu used by players.
   if(event===0){await page.goto(`${APP_URL}multigame`);await page.getByTestId('multi-continue').click();await waitForE2EDriver(page);}
   // Explicit finish fixture verifies scoring separately from natural-play coverage.
   await page.evaluate(()=>(window as any).__BADUGI_E2E__.forceHeroChampion());
   await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.multiGameSeries.v1')!).results.length)).toBe(event+1);
   await page.screenshot({path:info.outputPath(`${format}-${event}-result.png`)});
   await page.goto(`${APP_URL}multigame`);
   await expect(page.getByTestId('multi-series-progress')).toBeVisible();
   if(event<2&&format==='stage'){await page.getByTestId('multi-continue').click();await waitForE2EDriver(page);}
  }
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.multiGameSeries.v1')!));expect(saved.completed).toBe(true);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.tournament.v2')!).tournament)).toEqual(before);
  expect(errors).toEqual([]);
 }finally{await deleteAuthenticatedSession(page,session);}
});
