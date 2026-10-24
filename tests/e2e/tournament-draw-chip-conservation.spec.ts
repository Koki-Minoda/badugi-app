import {test,expect} from '@playwright/test';
import {APP_URL,enterTitleIfPresent,selectGameVariantFromSelector} from './authHelper';
import {waitForE2EDriver} from './helpers/gameProgressHelper.js';
import {visibleHeroActions} from './helpers/visibleHeroActions';
import {clickHeroAction} from './helpers/clickHeroAction';

for(const variant of (process.env.MGX_DRAW_CHIP_VARIANTS??'badacey_single_draw').split(',')) {
for(const delay of process.env.MGX_CPU_DECISION_DELAY_MS?[Number(process.env.MGX_CPU_DECISION_DELAY_MS)]:[0,2000]) {
 test(`${variant}: completed tournament hands conserve chips (${delay}ms CPU delay)`,async({page},testInfo)=>{
  test.setTimeout(180000);
  const histories=[]; page.on('console', message=>{if(message.text().startsWith('[HAND_HISTORY] ')) histories.push(JSON.parse(message.text().slice(15)));});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:9001,username:'QA Hero'})}));
  await page.addInitScript(()=>{
   localStorage.setItem('mgx_auth',JSON.stringify({accessToken:'test',user:{id:9001,username:'QA Hero'},isAuthenticated:true}));
   localStorage.setItem('mgx.previewVariants','true');
  });
  await page.goto(APP_URL);await enterTitleIfPresent(page);await page.getByTestId('menu-ring').click();
  await selectGameVariantFromSelector(page,variant);await waitForE2EDriver(page);
  if(delay) await page.evaluate(async delay=>{
   const moduleUrl=performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>url.includes('/src/games/draw/DeuceToSevenTripleDrawController.js'));
   const {DeuceToSevenTripleDrawController:Controller}=await import(moduleUrl);
   const original=Controller.prototype.getCpuActionAsync;
   Controller.prototype.getCpuActionAsync=async function(...args){window.__DELAYED_CPU_CALLS__=(window.__DELAYED_CPU_CALLS__??0)+1;const result=await original.apply(this,args);await new Promise(resolve=>setTimeout(resolve,delay));return result;};
  },delay);
  await page.evaluate(variant=>window.__BADUGI_E2E__.startTournamentMTT({id:'draw-deck-ownership',name:'Draw deck QA',practiceOnly:true,tables:2,seatsPerTable:6,totalPlayers:12,startingStack:500,gameVariant:variant,gameRotation:[variant],levels:[{levelIndex:1,smallBlind:5,bigBlind:10,ante:0,handsThisLevel:2},{levelIndex:2,smallBlind:10,bigBlind:20,ante:0,handsThisLevel:99}]}),variant);
  await expect.poll(()=>page.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot().handId)).toMatch(/^table-1-h/);
  const targetHands=Number(process.env.MGX_DRAW_CHIP_HANDS??(delay?3:10));
  const completed=new Set();const deadline=Date.now()+160000;
  while(completed.size<targetHands && Date.now()<deadline) {
   expect(errors,'CPU draw must not touch a second deck').toEqual([]);
   if(await page.getByTestId('hand-result-overlay').isVisible()) {
    const id=await page.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot().handId);
    completed.add(id);
    const history=histories.find(item=>item.handId===id);
    expect(history).toBeTruthy();
    expect(history.seats.reduce((sum,seat)=>sum+seat.endStack,0),'hand payout conserves the table chips').toBe(history.seats.reduce((sum,seat)=>sum+seat.startStack,0));
    const blinds=history.seats.flatMap(seat=>seat.actions).filter(action=>action.type==='blind');
    expect(blinds.find(action=>action.metadata.blind==='SB')?.amount).toBe(completed.size>2?10:5);
    expect(blinds.find(action=>action.metadata.blind==='BB')?.amount).toBe(completed.size>2?20:10);
    const tournament=await page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.tournament.mtt.active')).tournamentState);
    expect(tournament.levelIndex).toBe(completed.size>=2?1:0);
    expect(tournament.tables.find(table=>table.tableId==='table-1').handsPlayedAtThisLevel).toBe(completed.size>=2?completed.size-2:completed.size);
    await testInfo.attach(`hand-${completed.size}`,{body:JSON.stringify({id,tournament,controller:await page.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot().controllerSnapshot)}),contentType:'application/json'});
    expect(Object.values(tournament.players).reduce((sum,player)=>sum+player.stack,0)).toBe(6000);
    if(completed.size<targetHands) {await page.getByTestId('hand-result-next-hand').click();}
   } else {
    if((await visibleHeroActions(page)).includes('action-fold')) await clickHeroAction(page,'action-fold');
   }
   await page.waitForTimeout(100);
  }
  if(delay) expect(await page.evaluate(()=>window.__DELAYED_CPU_CALLS__??0)).toBeGreaterThan(0);
  expect(errors).toEqual([]);expect(completed.size).toBe(targetHands);
  const chips=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('mgx.tournament.mtt.active')).tournamentState.players).reduce((sum,p)=>sum+p.stack,0));
  expect(chips).toBe(6000);
  await testInfo.attach('verified-hands',{body:JSON.stringify({variant,hands:[...completed],chips,errors,apiStubbed:true}),contentType:'application/json'});
 });
}
}
