import {test,expect} from '@playwright/test';
import {APP_URL,enterTitleIfPresent,selectGameVariantFromSelector} from './authHelper';
import {waitForE2EDriver} from './helpers/gameProgressHelper.js';

for(const variant of ['D01','D02','S01','S02','badeucey_triple_draw','badacey_triple_draw','hidugi_triple_draw','archie_triple_draw','five_card_single_draw','badugi_single_draw','badeucey_single_draw','badacey_single_draw','hidugi_single_draw']) {
 test(`${variant}: CPU draws use one deck across tournament hands after hero folds`,async({page},testInfo)=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:9001,username:'QA Hero'})}));
  await page.addInitScript(()=>{
   localStorage.setItem('mgx_auth',JSON.stringify({accessToken:'test',user:{id:9001,username:'QA Hero'},isAuthenticated:true}));
   localStorage.setItem('mgx.previewVariants','true');
  });
  await page.goto(APP_URL);await enterTitleIfPresent(page);await page.getByTestId('menu-ring').click();
  await selectGameVariantFromSelector(page,variant);await waitForE2EDriver(page);
  await page.evaluate(variant=>window.__BADUGI_E2E__.startTournamentMTT({id:'draw-deck-ownership',name:'Draw deck QA',practiceOnly:true,tables:3,seatsPerTable:6,totalPlayers:18,startingStack:500,gameVariant:variant,gameRotation:[variant],levels:[{levelIndex:1,smallBlind:5,bigBlind:10,ante:0,handsThisLevel:99}]}),variant);
  const completed=new Set();const deadline=Date.now()+75000;
  while(completed.size<3 && Date.now()<deadline) {
   expect(errors,'CPU draw must not touch a second deck').toEqual([]);
   if(await page.getByTestId('hand-result-overlay').isVisible()) {
    const id=await page.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot().handId);
    completed.add(id);
    if(completed.size<3) await page.getByTestId('hand-result-next-hand').click();
   } else {
    const fold=page.getByTestId('action-fold');
    if(await fold.isVisible() && await fold.isEnabled()) await fold.click();
   }
   await page.waitForTimeout(100);
  }
  expect(errors).toEqual([]);expect(completed.size).toBe(3);
  const chips=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('mgx.tournament.mtt.active')).tournamentState.players).reduce((sum,p)=>sum+p.stack,0));
  expect(chips).toBe(9000);
  await testInfo.attach('verified-hands',{body:JSON.stringify({variant,hands:[...completed],chips,errors,apiStubbed:true}),contentType:'application/json'});
 });
}
