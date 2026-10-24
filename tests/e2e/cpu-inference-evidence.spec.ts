import {writeFile} from 'node:fs/promises';
import {test, expect} from '@playwright/test';
import {APP_URL, enterTitleIfPresent, selectGameVariantFromSelector} from './authHelper';
import {clickHeroAction} from './helpers/clickHeroAction';

for (const [variant, phases] of [['D01', ['BET','DRAW']], ['badacey_triple_draw', ['BET','DRAW']], ['nlh', ['BET']], ['ST1', ['BET']], ['dramaha_hi', ['BET','DRAW']]]) {
 test(`${variant}: persists request-scoped CPU decision evidence`, async ({page}, testInfo) => {
  test.setTimeout(120000);
  const rows = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
   const text = message.text();
   if (!text.startsWith('[E2E-ACTION]') || !text.includes('metadata=')) return;
   try {
    const metadata = JSON.parse(text.slice(text.indexOf('metadata=') + 9));
    if (metadata.inferenceTrace) rows.push(metadata.inferenceTrace);
   } catch { /* Ignore unrelated diagnostic formatting. */ }
  });
  await page.route('**/api/**', route => route.fulfill({status:200, contentType:'application/json', body:JSON.stringify({id:9001, username:'QA Hero'})}));
  await page.addInitScript(() => {
   localStorage.setItem('mgx_auth', JSON.stringify({accessToken:'test', user:{id:9001,username:'QA Hero'},isAuthenticated:true}));
   localStorage.setItem('mgx.previewVariants','true');
  });
  await page.goto(APP_URL); await enterTitleIfPresent(page); await page.getByTestId('menu-ring').click();
  await selectGameVariantFromSelector(page, variant);
  const deadline = Date.now() + 100000;
  while (Date.now() < deadline && !phases.every(phase => rows.some(row => row.phase === phase))) {
   expect(errors).toEqual([]);
   if (await page.getByTestId('hand-result-overlay').isVisible()) await page.getByTestId('hand-result-next-hand').click();
   else {
    const fold = page.getByTestId('action-fold');
    if (await fold.isVisible() && await fold.isEnabled()) await clickHeroAction(page, 'action-fold');
   }
   await page.waitForTimeout(100);
  }
  const evidence = JSON.stringify({variant, rows, errors, apiStubbed:true}, null, 2);
  await writeFile(testInfo.outputPath('inference-evidence.json'), evidence);
  await testInfo.attach('inference-evidence', {body:evidence,contentType:'application/json'});
  for (const phase of phases) expect(rows.some(row => row.phase === phase)).toBe(true);
  if (['nlh','ST1','dramaha_hi'].includes(variant)) expect(rows.every(row => row.status === 'not-connected' && ['automatic-check-call','default-stand-pat'].includes(row.reason))).toBe(true);
  for (const row of rows) {
   expect(row.elapsedMs).toBeGreaterThanOrEqual(0);
   if (row.status === 'used') expect(row.usedModelId).toBe(row.selectedModelId);
   else { expect(row.usedModelId).toBeNull(); expect(row.reason).toBeTruthy(); }
  }
 });
}
