import { test, expect } from '@playwright/test';
import { APP_URL, API_URL, createAuthenticatedSession, deleteAuthenticatedSession } from './authHelper';
import { playOneHandProgression } from './helpers/gameProgressHelper.js';

test('registration, login, reload and logout use the real local API', async ({ page }) => {
  const email = `device-audit-${Date.now()}@example.com`;
  const password = 'DeviceAudit!2026';
  await page.goto(APP_URL);
  await page.getByTestId('title-enter-button').click();
  await page.getByTestId('auth-signup-tab').click();
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-password').fill(password);
  await page.getByTestId('auth-confirm-password').fill('Mismatch!');
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('Passwords do not match.')).toBeVisible();
  await page.getByTestId('auth-confirm-password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('Signup successful. Please login.')).toBeVisible();
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('menu-ring')).toBeVisible();
  const authState = await page.evaluate(() => JSON.parse(localStorage.getItem('mgx_auth')!));
  try {
    await page.reload();
    await page.getByTestId('title-enter-button').click();
    await expect(page.getByTestId('menu-ring')).toBeVisible();
    await page.getByRole('button', { name: /^(Logout|ログアウト)$/ }).click();
    await expect(page.getByTestId('title-enter-button')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('mgx_auth'))).toBeNull();
    await page.getByTestId('title-enter-button').click();
    await expect(page.getByTestId('auth-email')).toBeVisible();
  } finally {
    // Logging out may invalidate the old token; log in only to delete the isolated test account.
    const login = await page.request.post(`${API_URL}/auth/login`, { data: { email, password } });
    expect(login.ok()).toBe(true);
    authState.accessToken = (await login.json()).access_token;
    await deleteAuthenticatedSession(page, { email, password, authState });
  }
});

test('Dealer Choice launches the selected queue into a playable table', async ({ page }, info) => {
  const session = await createAuthenticatedSession(page);
  await page.addInitScript(() => {
    localStorage.setItem('mgx.tournament.v2', JSON.stringify({ version: 2, tournament: { stageWins: {}, completedTournaments: [], history: [] }, career: { statistics: {}, worldChampionship: { cleared: true } }, rivals: {}, _meta: {} }));
  });
  try {
    await page.goto(`${APP_URL}dealers-choice`);
    await page.getByTestId('roulette-add').click();
    await expect(page.getByTestId('roulette-clear')).toContainText('(1)');
    await page.getByRole('combobox', { name: '遊ぶ種目' }).selectOption('D03');
    await page.getByTestId('roulette-add').click();
    await page.getByTestId('roulette-launch').click();
    await expect(page).toHaveURL(/game\?mode=dealers-choice/);
    await page.screenshot({ path: info.outputPath('dealer-choice-launch.png') });
    await info.attach('launch-state', { body: JSON.stringify(await page.evaluate(() => ({ url: location.href, queue: localStorage.getItem('dealersChoice.queue'), mode: localStorage.getItem('dealersChoice.mode'), text: document.body.innerText }))), contentType: 'application/json' });
    await expect(page.getByTestId('mixed-rotation-status')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__BADUGI_E2E__?.getStateSnapshot()?.gameVariant)).toBe('nlh');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dealersChoice.queue')!))).toEqual(['D03']);
    await playOneHandProgression(page, { maxSteps: 120, policy: 'heroStay', requireHeroButtonClick: true });
    await page.getByTestId('hand-result-next-hand').click();
    await expect.poll(() => page.evaluate(() => (window as any).__BADUGI_E2E__?.getStateSnapshot()?.gameVariant)).toBe('badugi');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dealersChoice.queue')!))).toEqual([]);
    await playOneHandProgression(page, { maxSteps: 140, policy: 'heroStay', requireHeroButtonClick: true, requireDrawVisit: true });
  } finally { await deleteAuthenticatedSession(page, session); }
});
