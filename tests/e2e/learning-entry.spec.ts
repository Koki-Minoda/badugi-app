import { test, expect } from '@playwright/test';

// Local frontend QA: auth/profile requests use fixtures. Gameplay uses the
// production-built engine; this suite makes no claim about backend integration.
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/auth/me')
    ? { id: 'learning-qa', username: 'Learning QA', email: 'learning@example.test' } : {} }));
  (page as any).learningErrors = errors;
});
test.afterEach(async ({ page }) => { expect((page as any).learningErrors).toEqual([]); });

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test('menu opens the learning hub, with no horizontal overflow', async ({ page }, info) => {
  await page.goto('/menu');
  await page.getByTestId('menu-learn').click();
  await expect(page.getByRole('heading', { name: '種目を覚えて、プレイする' })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('learning-hub.png'), fullPage: true });
});

test('compare rules, save once, reload and review an unchanged template', async ({ page }, info) => {
  await page.goto('/learn?plan=learn-lowball');
  await page.getByRole('button', { name: '2. 2-7 Triple Draw' }).click();
  await expect(page.getByRole('heading', { name: 'A-5 Triple Draw → 2-7 Triple Draw' })).toBeVisible();
  await expect(page.getByText('変更点 · 勝敗とAの扱い')).toBeVisible();
  await page.getByRole('button', { name: 'テンプレートを保存' }).click();
  await page.getByRole('button', { name: 'テンプレートを保存' }).click();
  await expect(page.getByRole('status')).toContainText('この端末に保存しました');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mixedGameProfiles')!).filter(p => p.id === 'learn-lowball'))).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A-5 Triple Draw → 2-7 Triple Draw' })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('learning-comparison.png'), fullPage: true });
  await page.getByRole('link', { name: 'MIX設定で確認' }).click();
  await expect(page.locator('input').filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator('input[value="Lowball Basics"]').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Mixed Game 開始/ })).toBeDisabled();
});

test('English persists and unpublished games remain study-only', async ({ page }) => {
  await page.goto('/learn?variant=flh');
  await expect(page.getByTestId('learn-play')).toHaveCount(0);
  await expect(page.getByText('この種目は現在、ルールの確認のみ利用できます。')).toBeVisible();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('en');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Learn a game. Play a hand.' })).toBeVisible();
  await expect(page.getByText('This game is currently available for rules study only.')).toBeVisible();
  await noOverflow(page);
});

test('play requires login when no session exists', async ({ page }) => {
  await page.goto('/learn?variant=badugi');
  await page.getByTestId('learn-play').click();
  await expect(page.getByTestId('auth-email')).toBeVisible();
  await expect(page.getByTestId('game-rule-reminder')).toHaveCount(0);
  await page.route('**/api/auth/login', route => route.fulfill({ json: { access_token: 'local-qa-login', token_type: 'bearer', user: { id: 'learning-qa', username: 'Learning QA' } } }));
  await page.getByTestId('auth-email').fill('learning@example.test');
  await page.getByTestId('auth-password').fill('LearningQA!2026');
  await page.getByTestId('auth-submit').click();
  await page.getByTestId('game-rule-reminder').click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Badugi', exact: true })).toBeVisible();
});

test('selected game starts after auth, rules close and betting remains usable', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('mgx_auth', JSON.stringify({ accessToken: 'local-qa-fixture', tokenType: 'Bearer', user: { id: 'learning-qa', username: 'Learning QA' } })));
  await page.goto('/learn?variant=ace_to_five_triple_draw');
  await page.getByTestId('learn-play').click();
  const trigger = page.getByTestId('game-rule-reminder');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const panel = page.getByRole('dialog', { name: '対局ルール' });
  await expect(panel.getByRole('heading', { name: 'A-5 Triple Draw' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '閉じる' })).toBeFocused();
  await noOverflow(page);
  // The game is a fixed viewport; a full-page capture resizes the responsive table.
  await page.screenshot({ path: info.outputPath('table-rules.png') });
  await panel.getByRole('button', { name: '閉じる' }).press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByTestId('action-fold').first()).toBeEnabled({ timeout: 15000 });
  await page.getByTestId('action-fold').first().click();
  await expect(trigger).toBeVisible();
  if (info.project.name !== 'desktop') {
    await page.setViewportSize({ width: 844, height: 390 });
    await trigger.click();
    await expect(panel.getByRole('button', { name: '閉じる' })).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: info.outputPath('table-rules-landscape.png') });
    await panel.getByText('手番', { exact: true }).scrollIntoViewIfNeeded();
    await expect(panel.getByText('手番', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: '閉じる' })).toBeVisible();
    await panel.getByRole('button', { name: '閉じる' }).click();
  }
});
