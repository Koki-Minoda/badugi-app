import { test, expect, type Page } from '@playwright/test';
const storeKey = 'mgx.handReviews.v1';
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function finishHand(page: Page) {
  for (let i = 0; i < 100; i++) {
    const state = await page.evaluate(() => (window as any).__BADUGI_E2E__.getStateSnapshot());
    if (['SHOWDOWN', 'HAND_RESULT', 'WAITING_NEXT_HAND'].includes(state.phase)) return state;
    await page.evaluate(() => {
      const api = (window as any).__BADUGI_E2E__;
      const state = api.getStateSnapshot();
      if (typeof state.turn === 'number') api.forceControllerAction(state.turn, { type: 'fold' });
    });
    await page.waitForTimeout(40);
  }
  throw new Error('Hand did not finish');
}

test('save a real hand result, annotate, reload, retain after history removal, and filter', async ({ page }, info) => {
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/auth/me') ? { id: 'review-qa', username: 'Review QA' } : {} }));
  await page.addInitScript(() => localStorage.setItem('mgx_auth', JSON.stringify({ accessToken: 'local-qa', user: { id: 'review-qa', username: 'Review QA' } })));
  await page.goto('/learn?variant=ace_to_five_triple_draw');
  await page.getByTestId('learn-play').click();
  await expect(page.getByTestId('game-rule-reminder')).toBeVisible();
  const ended = await finishHand(page);
  const result = page.getByTestId('hand-result-overlay');
  await expect(result).toBeVisible();
  await result.getByRole('button', { name: 'あとで復習に保存' }).click();
  await expect(result.getByRole('button', { name: '復習に保存済み' })).toBeDisabled();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).entries, storeKey);
  expect(saved).toHaveLength(1);
  expect(saved[0].hand.handId).toBe(ended.handId);
  expect(saved[0].hand.events.some(event => event.type === 'HAND_END')).toBe(true);
  await page.goto('/history');
  const row = page.locator('details').filter({ hasText: ended.handId }).first();
  await row.locator('summary').click();
  await expect(row.getByRole('button', { name: '復習に保存済み' })).toBeDisabled();
  await page.getByRole('button', { name: '復習一覧', exact: true }).click();
  const item = page.getByTestId('saved-hand');
  await item.locator('summary').click();
  await item.getByRole('textbox', { name: 'メモ', exact: true }).fill('最初のベット判断を復習する。');
  await item.getByLabel('タグ（カンマ区切り）').fill('ベット判断、A-5, ベット判断');
  await item.getByRole('button', { name: 'メモとタグを保存' }).click();
  await expect(item.getByRole('status')).toContainText('メモとタグを保存しました');
  await page.screenshot({ path: info.outputPath('saved-hand-notes.png'), fullPage: true });
  await noOverflow(page);
  await page.evaluate(() => { localStorage.removeItem('badugi.history.hands'); });
  await page.reload();
  await expect(item).toHaveCount(1);
  await item.locator('summary').click();
  await expect(item.getByRole('textbox', { name: 'メモ', exact: true })).toHaveValue('最初のベット判断を復習する。');
  await expect(item.getByLabel('タグ（カンマ区切り）')).toHaveValue('ベット判断, A-5');
  await expect(item.getByRole('heading', { name: 'アクション記録' })).toBeVisible();
  await page.getByRole('combobox', { name: '種目', exact: true }).selectOption('ace_to_five_triple_draw');
  await page.getByRole('combobox', { name: 'タグ', exact: true }).selectOption('A-5');
  await page.getByLabel('メモ・ハンドを検索').fill('見つからない');
  await expect(item).toHaveCount(0);
  await page.getByRole('button', { name: '絞り込みを解除' }).click();
  await expect(item).toHaveCount(1);
});

test('save different game histories with reused IDs, edit in English, and remove only one review', async ({ page }) => {
  await page.goto('/learn');
  await page.evaluate(() => {
    const hands = ['badugi', 'stud'].map((variantId, index) => ({ handId: 'same-id', variantId, startedAt: 1789260000000 + index, endedAt: 1789260001000 + index, events: [{ type: 'HAND_END', totalPot: 50, winners: [{ seat: 0, amount: 50 }] }], seats: [{ seat: 0, name: 'Hero', initialStack: 500, stackAfter: 525 }] }));
    localStorage.setItem('badugi.history.hands', JSON.stringify(hands));
  });
  await page.goto('/history');
  const rows = page.locator('details').filter({ hasText: 'same-id' });
  await expect(rows).toHaveCount(2);
  for (const row of await rows.all()) {
    await row.locator('summary').click();
    await row.getByRole('button', { name: 'あとで復習に保存' }).click();
  }
  await page.goto('/learn');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('en');
  await page.getByRole('link', { name: /Review saved hands/ }).click();
  await expect(page.getByRole('heading', { name: 'Saved hands' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Game', exact: true }).selectOption('stud');
  const item = page.getByTestId('saved-hand');
  await expect(item).toHaveCount(1);
  await item.locator('summary').click();
  await item.getByRole('textbox', { name: 'Notes', exact: true }).fill('Review the bring-in.');
  await item.getByRole('button', { name: 'Save notes and tags' }).click();
  await expect(item.getByRole('status')).toContainText('Notes and tags saved.');
  await item.getByRole('button', { name: 'Remove from saved hands' }).click();
  await item.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(item).toHaveCount(1);
  await item.getByRole('button', { name: 'Remove from saved hands' }).click();
  await item.getByRole('button', { name: 'Confirm removal' }).click();
  await expect(item).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(item).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('badugi.history.hands')!).length)).toBe(2);
  await noOverflow(page);
});
