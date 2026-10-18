import {expect,test} from '@playwright/test';
import {APP_URL,enterTitleIfPresent,selectGameVariantFromSelector} from './authHelper';
import {waitForE2EDriver} from './helpers/gameProgressHelper.js';

test('busted cash CPUs stay out of hands and return with portraits after the reseat delay',async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:393,height:695});
 await page.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:9001,username:'QA Hero',email:'qa@mgx-e2e.test'})}));
 await page.addInitScript(()=>localStorage.setItem('mgx_auth',JSON.stringify({accessToken:'test',tokenType:'Bearer',user:{id:9001,username:'QA Hero'},isAuthenticated:true})));
 await page.goto(APP_URL);await enterTitleIfPresent(page);await page.getByTestId('menu-ring').click();await selectGameVariantFromSelector(page,'badugi');await waitForE2EDriver(page);
 // Controlled post-settlement fixture; subsequent hands use real UI folds.
 await page.evaluate(()=>window.__BADUGI_E2E__.setupCashRebuyTerminalFixtureForTest());
 await expect(page.getByTestId('hand-result-overlay')).toBeVisible();
 const original=await page.evaluate(()=>{const s=window.__BADUGI_E2E__.getStateSnapshot();return {hand:s.handCount,name:s.players[1].name};});
 for(let offset=1;offset<=10;offset++){
  await page.getByTestId('hand-result-next-hand').click();
  await expect.poll(()=>page.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot().handCount)).toBe(original.hand+offset);
  const s=await page.evaluate(()=>window.__BADUGI_E2E__.getStateSnapshot());
  const opponent=s.players[1];
  if(offset<10){
   expect(opponent.seatOut).toBe(true);expect(opponent.stack).toBe(0);expect(s.controllerSnapshot.players[1].hand??[]).toHaveLength(0);
   await expect(page.getByTestId('seat-1')).toContainText('離席');
  }else{
   expect(opponent.seatOut).toBe(false);expect(opponent.stack).toBeGreaterThan(0);expect(s.controllerSnapshot.players[1].hand).toHaveLength(4);
   await expect.poll(()=>page.getByTestId('seat-1').locator('.mgx-seat-avatar img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
  }
  if(offset<10){await expect(page.getByTestId('action-fold')).toBeEnabled();await page.getByTestId('action-fold').click();await expect(page.getByTestId('hand-result-overlay')).toBeVisible();}
 }
});
