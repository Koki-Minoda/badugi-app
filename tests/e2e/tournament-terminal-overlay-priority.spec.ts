import {expect,test} from '@playwright/test';
import {APP_URL,enterTitleIfPresent,selectGameVariantFromSelector} from './authHelper';
import {waitForE2EDriver} from './helpers/gameProgressHelper.js';

async function waitForTournamentHand(page) {
 await expect.poll(()=>page.evaluate(()=>({
  mode:window.__BADUGI_E2E__?.getControllerDebug?.().mode,
  hand:window.__BADUGI_E2E__?.getStateSnapshot?.().handId?.startsWith('table-1-h'),
 }))).toEqual({mode:'tournament-mtt',hand:true});
}

for(const size of [{width:1440,height:900},{width:393,height:695},{width:852,height:283}]) for(const outcome of ['played','blind-all-in','hero-bust-fixture']){
 const blindAllIn=outcome==='blind-all-in';
 test(`settled all-in displays tournament result without a competing hand dialog at ${size.width}x${size.height} (${outcome})`,async({page},testInfo)=>{
  test.setTimeout(90000);const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
  page.on('console',message=>{if(message.text().includes('[G-10][FATAL]'))pageErrors.push(message.text());});
  await page.setViewportSize(size);
  await page.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:9001,username:'QA Hero',email:'qa@mgx-e2e.test'})}));
  await page.addInitScript(()=>localStorage.setItem('mgx_auth',JSON.stringify({accessToken:'test',tokenType:'Bearer',user:{id:9001,username:'QA Hero',email:'qa@mgx-e2e.test'},isAuthenticated:true})));
  await page.goto(`${APP_URL}?variant=nlh&mode=cash`);
  await enterTitleIfPresent(page);await page.getByTestId('menu-ring').click();
  await selectGameVariantFromSelector(page,'nlh');await waitForE2EDriver(page);
  await page.evaluate((blindAllIn)=>window.__BADUGI_E2E__.startTournamentMTT({
   id:'terminal-dialog-regression',name:'Terminal dialog regression',practiceOnly:true,
   tables:1,seatsPerTable:6,totalPlayers:2,startingStack:blindAllIn?5:30,gameVariant:'nlh',gameRotation:['nlh'],rotationPolicy:'fixed',
   levels:[{levelIndex:1,smallBlind:5,bigBlind:10,ante:0,handsThisLevel:999}],payouts:[{place:1,percent:100}],
  }),blindAllIn);
  await waitForTournamentHand(page);
  if(outcome==='hero-bust-fixture'){
   // Presentation coverage only; natural elimination is covered by the separate MTT gate.
   await expect(page.getByTestId('tournament-hud')).toBeVisible();
   await page.evaluate(()=>window.__BADUGI_E2E__.forceHeroBust());
   await expect(page.getByTestId('mtt-hero-bust-overlay')).toBeVisible();
  }
  // Drive legal all-ins through the controller; winners and payouts are evaluated normally.
  const terminal=page.locator('[data-testid=mtt-hero-bust-overlay],[data-testid=mtt-result-overlay]');
  for(let step=0;step<100;step++){
   if(await terminal.count())break;
   if(await page.getByTestId('hand-result-overlay').count())await page.getByTestId('hand-result-next-hand').click();
   else await page.evaluate(()=>{
    const api=window.__BADUGI_E2E__,s=api?.getStateSnapshot?.()?.controllerSnapshot;
    const actor=s?.currentActor??s?.turn,p=s?.players?.[actor];
    if(typeof actor==='number'&&p&&!p.allIn&&!p.folded){const r=api.forceControllerAction(actor,{type:'raise',amount:p.stack});if(!r)api.forceControllerAction(actor,{type:'call'});}
   });
   await page.waitForTimeout(150);
  }
  await expect(terminal).toBeVisible();
  await expect(page.getByTestId('hand-result-overlay')).toHaveCount(0);
  const state=await page.evaluate(()=>window.__BADUGI_E2E__.getTournamentHudState());
  expect(state.isFinished).toBe(true);expect(state.playersRemaining).toBe(1);
  expect(await page.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot().handId)).toMatch(/^table-1-h/);
  const back=terminal.getByRole('button',{name:/back to menu/i});
  const exit=await back.evaluate(button=>{
   const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,reachable:hit===button||button.contains(hit)};
  });
  expect(exit.top).toBeGreaterThanOrEqual(0);expect(exit.bottom).toBeLessThanOrEqual(size.height);
  expect(exit.left).toBeGreaterThanOrEqual(0);expect(exit.right).toBeLessThanOrEqual(size.width);
  expect(exit.height).toBeGreaterThanOrEqual(44);expect(exit.reachable).toBe(true);
  await page.screenshot({path:testInfo.outputPath('terminal-before-scroll.png')});
  await back.click();
  await expect(page.getByTestId('menu-ring')).toBeVisible();
  expect(pageErrors).toEqual([]);
 });
}

test('Badugi tournament can deal the next hand after a folded hero settlement',async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:852,height:283});
 await page.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:9001,username:'QA Hero',email:'qa@mgx-e2e.test'})}));
 await page.addInitScript(()=>localStorage.setItem('mgx_auth',JSON.stringify({accessToken:'test',tokenType:'Bearer',user:{id:9001,username:'QA Hero'},isAuthenticated:true})));
 await page.goto(APP_URL);await enterTitleIfPresent(page);await page.getByTestId('menu-ring').click();await selectGameVariantFromSelector(page,'badugi');await waitForE2EDriver(page);
 await page.evaluate(()=>window.__BADUGI_E2E__.startTournamentMTT({id:'badugi-next',name:'Badugi next',practiceOnly:true,tables:3,seatsPerTable:6,totalPlayers:18,startingStack:500,gameVariant:'badugi',gameRotation:['badugi'],levels:[{levelIndex:1,smallBlind:5,bigBlind:10,ante:0,handsThisLevel:999}]}));
 await waitForTournamentHand(page);
 await expect(page.getByTestId('action-fold')).toBeEnabled();await page.getByTestId('action-fold').click();await expect(page.getByTestId('hand-result-overlay')).toBeVisible({timeout:40000});
 const before=await page.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot().handId);
 await page.getByTestId('hand-result-next-hand').click();
 await expect.poll(()=>page.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot().handId),{timeout:10000}).not.toBe(before);
 await expect(page.getByTestId('hand-result-overlay')).toHaveCount(0);
 await expect(page.getByTestId('action-fold')).toBeEnabled({timeout:10000});await page.getByTestId('action-fold').click();
 await expect(page.getByTestId('hand-result-overlay')).toBeVisible({timeout:40000});
 const chips=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('mgx.tournament.mtt.active')).tournamentState.players).reduce((n,p)=>n+p.stack,0));expect(chips).toBe(9000);
});

test('Badugi tournament remains playable through three draws and the final betting round',async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width:852,height:283});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:9001,username:'QA Hero'})}));
 await page.addInitScript(()=>localStorage.setItem('mgx_auth',JSON.stringify({accessToken:'test',user:{id:9001,username:'QA Hero'},isAuthenticated:true})));
 await page.goto(APP_URL);await enterTitleIfPresent(page);await page.getByTestId('menu-ring').click();await selectGameVariantFromSelector(page,'badugi');await waitForE2EDriver(page);
 await page.evaluate(()=>window.__BADUGI_E2E__.startTournamentMTT({id:'badugi-draw',name:'Badugi draw',practiceOnly:true,tables:1,seatsPerTable:6,totalPlayers:6,startingStack:500,gameVariant:'badugi',gameRotation:['badugi'],levels:[{levelIndex:1,smallBlind:5,bigBlind:10,ante:0,handsThisLevel:999}]}));
 await waitForTournamentHand(page);
 const draws=new Set();let actions=0;
 for(let step=0;step<200;step++){
  if(await page.getByTestId('hand-result-overlay').count())break;
  for(const id of ['action-check','action-call','action-draw-selected']){
   const button=page.getByTestId(id);if(await button.count()&&await button.isEnabled()){
    if(id==='action-draw-selected')draws.add(await page.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot().drawRound));
    await button.click();actions++;break;
   }
  }
  await page.waitForTimeout(150);
 }
 await expect(page.getByTestId('hand-result-overlay')).toBeVisible();
 expect(draws.size).toBe(3);expect(actions).toBeGreaterThanOrEqual(7);
 expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('mgx.tournament.mtt.active')).tournamentState.players).reduce((n,p)=>n+p.stack,0))).toBe(3000);
 expect(errors).toEqual([]);
});
