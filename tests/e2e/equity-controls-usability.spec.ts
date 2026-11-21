import { test, expect } from '@playwright/test';
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`equity separates editing from discards at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto(`${process.env.E2E_APP_URL ?? 'http://127.0.0.1:3000/dev'}/tools?tab=equity`);
    const hero = page.getByRole('group', { name: '自分 · 4/4', exact: true });
    await hero.getByText('K♥', { exact: true }).first().click();
    await expect(hero).toBeVisible();
    const discard = hero.getByRole('button', { name: 'K♥ を交換', exact: true });
    await expect(discard).toHaveAttribute('aria-pressed', 'true');
    await discard.click();
    await expect(discard).toHaveAttribute('aria-pressed', 'false');
    await expect(hero).toBeVisible();
    await page.screenshot({ path: info.outputPath('equity-card-controls.png') });
    await hero.getByText('手札を編集', { exact: true }).click();
    await hero.getByRole('button', { name: 'ハート', exact: true }).click();
    await hero.getByRole('button', { name: 'K♥', exact: true }).click();
    await expect(page.getByRole('group', { name: '自分 · 3/4', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
