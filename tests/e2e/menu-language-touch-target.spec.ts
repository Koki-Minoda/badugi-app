import { expect, test } from '@playwright/test';
import { LANGUAGE_STORAGE_KEY } from '../../src/config/mgxLocaleConfig.js';

const APP_URL = process.env.E2E_APP_URL ?? 'http://127.0.0.1:3000';

for (const viewport of [{ width: 390, height: 844 }, { width: 852, height: 320 }]) {
  test(`settings language controls stay touchable at ${viewport.width}x${viewport.height}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/**', (route) => route.fulfill({
      json: { id: 7010, username: 'Language QA', email: 'language.qa@mgx-e2e.test' },
    }));
    await page.addInitScript(() => localStorage.setItem('mgx_auth', JSON.stringify({
      accessToken: 'local-language-qa', tokenType: 'Bearer', isAuthenticated: true,
      user: { id: 7010, username: 'Language QA', email: 'language.qa@mgx-e2e.test' },
    })));
    await page.goto(APP_URL);
    await page.getByTestId('title-enter-button').click();

    const settings = page.getByRole('button', { name: 'Open Settings' });
    await expect(settings).toBeVisible();
    const settingsBox = await settings.boundingBox();
    expect(settingsBox?.width).toBeGreaterThanOrEqual(44);
    expect(settingsBox?.height).toBeGreaterThanOrEqual(44);
    await settings.click();

    const language = page.getByTestId('language-select');
    await expect(language).toBeVisible();
    const dimensions = await language.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, fontSize: parseFloat(getComputedStyle(element).fontSize) };
    });
    expect(dimensions.height).toBeGreaterThanOrEqual(44);
    expect(dimensions.fontSize).toBeGreaterThanOrEqual(16);

    await language.selectOption('en');
    await expect(language).toHaveValue('en');
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), LANGUAGE_STORAGE_KEY)).toBe('en');
    await page.screenshot({ path: info.outputPath('language-settings.png') });
    const close = page.getByRole('button', { name: 'Close' });
    const closeBox = await close.boundingBox();
    expect(closeBox?.height).toBeGreaterThanOrEqual(44);
    await close.click();

    await page.reload();
    await page.getByTestId('title-enter-button').click();
    await settings.click();
    await expect(language).toHaveValue('en');
  });
}
