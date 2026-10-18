import {multiGameVariantForTable} from '../../src/games/config/multiGameTournament.js';
import {test,expect} from '@playwright/test';
import {APP_URL,createAuthenticatedSession,deleteAuthenticatedSession} from './authHelper';
import {playOneHandProgression,waitForE2EDriver} from './helpers/gameProgressHelper.js';
for(const format of ['stage','survival','championship'])test(`${format}: natural tournament completion`,async({page},info)=>{
 test.setTimeout(600000);page.setDefaultTimeout(15000);
 const session=await createAuthenticatedSession(page);
 await page.addInitScript(()=>localStorage.setItem('mgx.tournament.v2',JSON.stringify({version:2,tournament:{stageWins:{},completedTournaments:[],history:[]},career:{statistics:{},worldChampionship:{cleared:true}},rivals:{},_meta:{}})));
 const events=[];
 try{
  await page.goto(`${APP_URL}multigame`);await page.getByTestId(`multi-format-${format}`).click();
  for(let i=0;i<3;i++)await page.getByRole('combobox',{name:`${i+1}種目目`,exact:true}).selectOption(['badugi','nlh','stud'][i]);
  await page.getByTestId('multi-start').click();await waitForE2EDriver(page);
  for(let event=0;event<(format==='stage'?3:1);event++){
   let played=0,background=0;const variants=new Set();let complete=false;
   for(let turn=0;turn<1200;turn++){
    const hud=await page.evaluate(()=>(window as any).__BADUGI_E2E__.getTournamentHudState());
    if(hud.isFinished){expect(hud.playersRemaining).toBe(1);expect(hud.championId).toBeTruthy();complete=true;break;}
    if(hud.heroBusted){await page.evaluate(()=>(window as any).__BADUGI_E2E__.simulateTournamentBackground(1));background++;continue;}
    const pause=page.getByRole('button',{name:'休憩を終了して続ける'});if(await pause.isVisible())await pause.click();
    const activeVariant=await page.evaluate(()=>(window as any).__BADUGI_E2E__.getStateSnapshot().gameVariant);
    variants.add(activeVariant);
    const current=await page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.tournament.mtt.active')!).tournamentState);
    expect(activeVariant).toBe(multiGameVariantForTable(current,hud.heroTableId));
    const completedBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.tournament.mtt.active')!).tournamentState.completedHandIds.length);
    const result=await playOneHandProgression(page,{maxSteps:180,policy:'safe',requireHeroButtonClick:false});expect(result.status).toBe('PASS');played++;
    const after=await page.evaluate(()=>(window as any).__BADUGI_E2E__.getTournamentHudState());
    if(after.isFinished||after.heroBusted)continue;
    const completedAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.tournament.mtt.active')!).tournamentState.completedHandIds.length);
    expect(completedAfter,'every played hand advances the tournament').toBeGreaterThan(completedBefore);
    const breakAfter=page.getByRole('button',{name:'休憩を終了して続ける'});if(await breakAfter.isVisible())await breakAfter.click();
    const prior=await page.evaluate(()=>(window as any).__BADUGI_E2E__.getStateSnapshot());
    const next=page.getByTestId('hand-result-next-hand');await expect(next).toBeVisible();await next.click();
    await expect.poll(()=>page.evaluate(()=>(window as any).__BADUGI_E2E__.getStateSnapshot().handId)).not.toBe(prior.handId);
   }
   expect(complete).toBe(true);expect(played).toBeGreaterThan(0);
   events.push({event,played,background,variants:[...variants]});
   await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.multiGameSeries.v1')!).results.length)).toBe(event+1);
   await page.goto(`${APP_URL}multigame`);
   if(format==='stage'&&event<2){await page.getByTestId('multi-continue').click();await waitForE2EDriver(page);}
  }
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.multiGameSeries.v1')!).completed)).toBe(true);
  await info.attach('natural-completion',{body:JSON.stringify({format,events}),contentType:'application/json'});
 }finally{await deleteAuthenticatedSession(page,session);}
});
