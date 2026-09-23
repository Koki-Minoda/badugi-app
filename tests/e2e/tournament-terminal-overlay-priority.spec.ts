import {expect,test} from '@playwright/test';
import {APP_URL,enterTitleIfPresent,selectGameVariantFromSelector} from './authHelper';
import {waitForE2EDriver} from './helpers/gameProgressHelper.js';

for(const size of [{width:1440,height:900},{width:393,height:695},{width:852,height:283}]) for(const blindAllIn of [false,true]){
 test(`settled all-in displays tournament result without a competing hand dialog at ${size.width}x${size.height} (blind all-in: ${blindAllIn})`,async({page})=>{
  test.setTimeout(90000);
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
  await terminal.getByRole('button',{name:/back to menu/i}).click();
  await expect(page.getByTestId('menu-ring')).toBeVisible();
 });
}

test('Badugi tournament can deal the next hand after a folded hero settlement',async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:852,height:283});
 const logs=[];page.on('console',m=>{if(/next.hand|HAND.*start|stale|Maximum/.test(m.text()))logs.push(m.text());});
 await page.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:9001,username:'QA Hero',email:'qa@mgx-e2e.test'})}));
 await page.addInitScript(()=>localStorage.setItem('mgx_auth',JSON.stringify({accessToken:'test',tokenType:'Bearer',user:{id:9001,username:'QA Hero'},isAuthenticated:true})));
 await page.goto(APP_URL);await enterTitleIfPresent(page);await page.getByTestId('menu-ring').click();await selectGameVariantFromSelector(page,'badugi');await waitForE2EDriver(page);
 await page.evaluate(()=>window.__BADUGI_E2E__.startTournamentMTT({id:'badugi-next',name:'Badugi next',practiceOnly:true,tables:3,seatsPerTable:6,totalPlayers:18,startingStack:500,gameVariant:'badugi',gameRotation:['badugi'],levels:[{levelIndex:1,smallBlind:5,bigBlind:10,ante:0,handsThisLevel:999}]}));
 await expect(page.getByTestId('action-fold')).toBeEnabled();await page.getByTestId('action-fold').click();await expect(page.getByTestId('hand-result-overlay')).toBeVisible({timeout:40000});
 const before=await page.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot().handId);
 await page.getByTestId('hand-result-next-hand').click();
 try{await expect.poll(()=>page.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot().handId),{timeout:10000}).not.toBe(before);}
 catch(e){console.log('NEXT HAND DIAGNOSTIC',logs,await page.evaluate(()=>({state:window.__BADUGI_E2E__.getStateSnapshot(),hud:window.__BADUGI_E2E__.getTournamentHudState()})));throw e;}
 await expect(page.getByTestId('hand-result-overlay')).toHaveCount(0);
 await expect(page.getByTestId('action-fold')).toBeEnabled({timeout:10000});await page.getByTestId('action-fold').click();
 await expect(page.getByTestId('hand-result-overlay')).toBeVisible({timeout:40000});
});
