import { test, expect } from '@playwright/test';

test('mobile menu exposes play, history, learning and settings without introductory scrolling', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`${process.env.E2E_APP_URL ?? 'http://127.0.0.1:3000/dev'}/menu`);
  for (const id of ['menu-ring', 'menu-tournament', 'menu-history', 'menu-learn', 'menu-settings']) {
    await expect(page.getByTestId(id)).toBeInViewport();
  }
  await expect(page.getByTestId('menu-variant-select')).toHaveCount(0);
  await expect(page.getByText('シーズン 02')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('mobile-menu.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
