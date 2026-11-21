import { test, expect, devices } from '@playwright/test';

for (const [name, device] of [
  ['desktop', { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }],
  ['iphone', { ...devices['iPhone SE'] }],
] as const) {
  test(`${name}: keeps hand and actions in view before CPU details`, async ({ playwright }, info) => {
      const browser = await playwright[device.defaultBrowserType].launch();
      const context = await browser.newContext({ ...device, baseURL: process.env.E2E_APP_URL ?? 'http://127.0.0.1:3000' });
      const page = await context.newPage();
      try {
      await page.goto(process.env.E2E_APP_URL ? '/learn/practice' : '/dev/learn/practice');
      await page.getByLabel('全席を自分で操作する').check();
      await page.getByLabel('全員の手札を表示する').check();
      await page.getByRole('button', { name: 'この手札で練習する' }).click();
      const hand = page.getByTestId('practice-hero-hand');
      const actions = page.getByTestId('practice-actions');
      await expect(hand).toBeInViewport();
      await expect(actions.getByRole('button').first()).toBeInViewport();
      const handBox = await hand.boundingBox();
      const actionsBox = await actions.boundingBox();
      const cpuBox = await page.getByTestId('practice-cpu-1').boundingBox();
      expect(handBox!.y).toBeGreaterThanOrEqual(0);
      expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      expect(cpuBox!.y).toBeGreaterThan(actionsBox!.y + actionsBox!.height);
      await expect(page.getByTestId('practice-cpu-1')).not.toContainText('▧');
      await page.screenshot({ path: info.outputPath('practice-controls.png') });
      const before = await page.getByTestId('practice-turn').textContent();
      await actions.getByRole('button', { name: /^(チェック|コール)/ }).first().click();
      await expect(page.getByTestId('practice-turn')).not.toHaveText(before!);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      } finally { await browser.close(); }
  });
}
