import fs from 'node:fs';
import {test, expect} from '@playwright/test';
import {APP_URL, openAuthenticatedGame} from './authHelper';
import {invokeE2E, waitForE2EDriver} from './helpers/gameProgressHelper.js';

test('live NLH shows a neutral name instead of email and spaces CPU actions', async ({page}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    const observed: {at:number;seat:number}[] = [];
    (window as any).__paceSamples = observed;
    let handId: string | null = null, count = 0;
    setInterval(() => {
      const hand = (window as any).__BADUGI_E2E__?.getCurrentHandHistory?.();
      if (!hand) return;
      if (hand.handId !== handId) {handId = hand.handId; count = 0; observed.length = 0;}
      const events = hand.events.filter((e:any) => e.type === 'BET_ACTION' && e.seat !== 0);
      for (const event of events.slice(count)) observed.push({at:performance.now(),seat:event.seat});
      count = events.length;
    }, 10);
  });
  await openAuthenticatedGame(page, `${APP_URL}?variant=nlh&mode=cash`);
  await waitForE2EDriver(page);
  const action = page.locator('[data-testid="action-call"]:visible, [data-testid="action-check"]:visible').first();
  await expect(action).toBeEnabled({timeout:30000});
  const current = await invokeE2E(page, 'getCurrentHandHistory');
  const cpu = current.events.filter((e: any) => e.type === 'BET_ACTION' && e.seat !== 0);
  expect(cpu.length).toBeGreaterThanOrEqual(3);
  const samples = await page.evaluate(() => (window as any).__paceSamples);
  expect(samples.length).toBeGreaterThanOrEqual(3);
  const intervals = samples.slice(1).map((e: any, i: number) => e.at - samples[i].at);
  // 380ms configured board pacing; observe with a 10ms browser wall-clock sampler.
  for (const interval of intervals) expect(interval).toBeGreaterThanOrEqual(350);
  expect(current.seats.find((s: any) => s.seat === 0).name).toBe('You');
  fs.mkdirSync('reports/ui', {recursive:true});
  fs.writeFileSync('reports/ui/player-pace-observation.json', JSON.stringify({generatedAt:new Date().toISOString(),variant:'NLH',intervals,minimumExpectedMs:350,scope:'normal board CPU actions, local Chromium',releaseGatePassed:false},null,2));
});

test('an existing settings form saves the nickname used at the table', async ({page}) => {
  test.setTimeout(120000);
  await page.goto(`${APP_URL.replace(/\/$/, '')}/settings`);
  await page.getByLabel('プレイヤー名', {exact:true}).fill('Mixed Koki');
  await page.getByRole('button', {name:'保存する',exact:true}).click();
  await expect(page.getByText('保存しました',{exact:true})).toBeVisible();
  await openAuthenticatedGame(page, `${APP_URL}?variant=nlh&mode=cash`);
  await waitForE2EDriver(page);
  const current = await invokeE2E(page, 'getCurrentHandHistory');
  expect(current.seats.find((s: any) => s.seat === 0).name).toBe('Mixed Koki');
});
