import { expect, test } from '@playwright/test';
import { APP_URL, enterTitleIfPresent, selectGameVariantFromSelector } from './authHelper';
import { waitForE2EDriver } from './helpers/gameProgressHelper.js';

for (const viewport of [{ width: 750, height: 342 }, { width: 852, height: 283 }]) {
  test(`tournament payouts remain visible on ${viewport.width}x${viewport.height} landscape`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await page.route('**/api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 9001, username: 'QA Hero' }),
    }));
    await page.addInitScript(() => localStorage.setItem('mgx_auth', JSON.stringify({
      accessToken: 'test', user: { id: 9001, username: 'QA Hero' }, isAuthenticated: true,
    })));
    await page.goto(APP_URL);
    await enterTitleIfPresent(page);
    await page.getByTestId('menu-ring').click();
    await selectGameVariantFromSelector(page, 'nlh');
    await waitForE2EDriver(page);
    await page.evaluate(() => window.__BADUGI_E2E__.startTournamentMTT({
      id: 'short-landscape-results', name: 'Short landscape results', practiceOnly: true,
      tables: 3, seatsPerTable: 6, totalPlayers: 18, startingStack: 500,
      gameVariant: 'nlh', gameRotation: ['nlh'], rotationPolicy: 'fixed',
      levels: [{ levelIndex: 1, smallBlind: 5, bigBlind: 10, ante: 0, handsThisLevel: 999 }],
    }));
    await expect.poll(() => page.evaluate(() => window.__BADUGI_E2E__?.getControllerDebug?.().mode)).toBe('tournament-mtt');
    await page.evaluate(() => window.__BADUGI_E2E__.forceHeroBust());
    const overlay = page.getByTestId('mtt-hero-bust-overlay');
    await expect(overlay).toBeVisible();
    const rows = overlay.getByTestId('mtt-hero-bust-itm-row');
    await expect(rows).toHaveCount(3);
    const visiblePayouts = await overlay.evaluate(element => {
      const scroll = element.querySelector('[data-testid="mtt-hero-bust-scroll-content"]');
      const footer = element.querySelector('[data-testid="mtt-hero-bust-footer"]');
      const limit = Math.min(scroll.getBoundingClientRect().bottom, footer.getBoundingClientRect().top);
      return [...element.querySelectorAll('[data-testid="mtt-hero-bust-itm-row"]')]
        .filter(row => {
          const rect = row.getBoundingClientRect();
          return (Math.min(rect.bottom, limit) - Math.max(rect.top, scroll.getBoundingClientRect().top)) / rect.height >= 0.75;
        }).length;
    });
    expect(visiblePayouts).toBeGreaterThanOrEqual(viewport.height >= 340 ? 3 : 2);
    const back = overlay.getByRole('button', { name: /back to menu/i });
    await expect(back).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('result-before-scroll.png') });
    const scroll = overlay.getByTestId('mtt-hero-bust-scroll-content');
    const scrollState = await scroll.evaluate(element => {
      const previous = element.scrollTop;
      element.scrollTop = element.scrollHeight;
      return { previous, current: element.scrollTop, height: element.scrollHeight, visible: element.clientHeight };
    });
    expect(scrollState.height).toBeGreaterThan(scrollState.visible);
    expect(scrollState.current).toBeGreaterThan(scrollState.previous);
    await expect(overlay.getByTestId('mtt-tournament-review')).toBeInViewport();
    await back.click();
    await expect(page.getByTestId('menu-ring')).toBeVisible();
  });
}
