import {test, expect, chromium, webkit} from '@playwright/test';
import {APP_URL, openAuthenticatedGame} from './authHelper';
import {invokeE2E, waitForE2EDriver, getProgressState} from './helpers/gameProgressHelper.js';

const profiles = [
  {name: 'desktop', engine: 'chromium', width: 1280, height: 900, mobile: false},
  {name: 'android-portrait', engine: 'chromium', width: 390, height: 844, mobile: true},
  {name: 'android-short-landscape', engine: 'chromium', width: 844, height: 320, mobile: true},
  {name: 'iphone-portrait', engine: 'webkit', width: 390, height: 844, mobile: true},
  {name: 'iphone-short-landscape', engine: 'webkit', width: 844, height: 320, mobile: true},
] as const;

for (const profile of profiles) test.describe(profile.name, () => {
  for (const variant of ['nlh', 'stud8', 'D01']) test(`${variant} line is one tap away and returns to the same decision`, async () => {
    test.setTimeout(120000);
    const browser = await ({chromium, webkit}[profile.engine]).launch();
    try {
    const context = await browser.newContext({viewport: {width: profile.width, height: profile.height}, isMobile: profile.mobile, hasTouch: profile.mobile});
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('mgx.previewVariants', 'true'));
    await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}&mode=cash${profile.mobile ? '&mgxQa=mobile' : ''}`);
    await waitForE2EDriver(page);
    await invokeE2E(page, 'setupMobileTournamentHeroActionFixtureForTest', {variantId: variant});
    const trigger = page.getByTestId('current-hand-history-open');
    const sheet = page.getByTestId('current-hand-history');
    await expect(trigger).toBeVisible();
    await expect(sheet).not.toBeVisible();
    const before = await getProgressState(page);
    if (profile.mobile) await trigger.tap(); else await trigger.click();
    await expect(sheet).toBeVisible();
    const close = sheet.getByRole('button', {name: /^(閉じる|Close)$/});
    await expect(close).toBeFocused();
    // Native modal focus cannot tab back into the game or its actions.
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab');
      expect(await sheet.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    const box = await sheet.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(profile.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(profile.height + 1);
    const closeBox = await close.boundingBox();
    expect(closeBox!.width).toBeGreaterThanOrEqual(44);
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible();
    await expect(trigger).toBeFocused();
    const after = await getProgressState(page);
    expect(after.handId).toBe(before.handId);
    expect(after.currentBet).toBe(before.currentBet);
    await trigger.click();
    await close.click();
    await expect(trigger).toBeFocused();
    await expect(page.getByTestId('decision-panel')).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({path: `reports/screenshots/decision-first-line/${profile.name}-${variant}.png`, fullPage: true});
    } finally { await browser.close(); }
  });
});

// Layout fixtures deliberately use a read-only controller. Verify real events
// separately on a live hand rather than pretending fixture clicks are play.
test('live NLH exposes recorded CPU actions in the current hand', async ({page}) => {
  test.setTimeout(120000);
  await page.setViewportSize({width:1280,height:900});
  await openAuthenticatedGame(page, `${APP_URL}?variant=nlh&mode=cash`);
  await waitForE2EDriver(page);
  const action = page.locator('[data-testid="action-call"]:visible, [data-testid="action-check"]:visible').first();
  await expect(action).toBeEnabled({timeout:30000});
  await page.getByTestId('current-hand-history-open').click();
  const sheet=page.getByTestId('current-hand-history');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('li')).not.toHaveCount(0);
  await expect(sheet).toContainText(/call|check|raise|fold/i);
  await page.screenshot({path:'reports/screenshots/decision-first-line/desktop-nlh-open.png'});
  await sheet.getByRole('button',{name:/^(閉じる|Close)$/}).click();
  await expect(action).toBeEnabled();
});
