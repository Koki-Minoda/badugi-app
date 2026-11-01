import {writeFile} from 'node:fs/promises';
import {test, expect} from '@playwright/test';
import {APP_URL, enterTitleIfPresent, selectGameVariantFromSelector} from './authHelper';

const cases = [
 ['B01', 'nlh'], ['B02', 'flh'], ['B05', 'plo'], ['B06', 'plo8'],
 ['ST1', 'stud'], ['ST2', 'stud8'], ['ST3', 'razz'],
] as const;

for (const [variantId, appVariant] of cases) {
 test(`${variantId} exposes a live controller betting snapshot for F03 audit`, async ({page}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({id:9001, username:'QA Hero'})}));
  await page.addInitScript(() => {
   localStorage.setItem('mgx_auth', JSON.stringify({accessToken:'test', user:{id:9001,username:'QA Hero'},isAuthenticated:true}));
   localStorage.setItem('mgx.previewVariants','true');
   localStorage.setItem('dev.aiTierOverride','standard');
  });
  await page.goto(APP_URL); await enterTitleIfPresent(page); await page.getByTestId('menu-ring').click();
  await selectGameVariantFromSelector(page, appVariant);
  await page.waitForFunction(() => {
   const snapshot = (window as any).__BADUGI_E2E__?.getStateSnapshot?.()?.controllerSnapshot;
   return snapshot?.phase === 'BET' && snapshot.players?.length > 1 && typeof snapshot.currentActor === 'number';
  }, undefined, {timeout:10000});
  const trace = await page.evaluate((id) => {
   const state = (window as any).__BADUGI_E2E__.getStateSnapshot();
   const snapshot = state.controllerSnapshot;
   const seat = snapshot.currentActor;
   const actor = snapshot.players[seat];
   return {
    variantId:id, phase:snapshot.phase, street:snapshot.street,
    seatIndex:seat, seatCount:snapshot.players.length,
    currentBet:snapshot.currentBet, pot:snapshot.pot,
    actorStack:actor?.stack, actorBet:actor?.betThisStreet,
    toCall:Math.max(0, Number(snapshot.currentBet ?? 0) - Number(actor?.betThisStreet ?? 0)),
    potToActorStack:Number(snapshot.pot ?? 0) / Math.max(1, Number(actor?.stack ?? 0)),
    holeCardCount:actor?.holeCards?.length ?? null,
    upCardCount:actor?.upCards?.length ?? null,
    boardCardCount:snapshot.boardCards?.length ?? null,
    activeOpponentCount:snapshot.players.filter((player:any, index:number)=>index!==seat && player && !player.folded && !player.seatOut && !player.allIn).length,
    controllerFields:Object.keys(snapshot).sort(),
    actorFields:Object.keys(actor ?? {}).sort(),
    errors:[], apiStubbed:true,
   };
  }, variantId);
  trace.errors = errors;
  await writeFile(testInfo.outputPath('f03-live-snapshot.json'), JSON.stringify(trace,null,2));
  expect(trace.phase).toBe('BET');
  expect(trace.seatIndex).toBeGreaterThanOrEqual(0);
  expect(trace.actorStack).toBeGreaterThan(0);
  expect(trace.toCall).toBeGreaterThanOrEqual(0);
  expect(errors).toEqual([]);
 });
}
