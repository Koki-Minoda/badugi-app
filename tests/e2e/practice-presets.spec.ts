import { test, expect } from '@playwright/test';
const games = [
  { id: 'badugi', alias: 'D03', cards: ['AS', '2H', '3D', '4C'], labels: ['A♠', '2♥', '3♦', '4♣'] },
  { id: 'ace_to_five_triple_draw', alias: 'D02', cards: ['AS', '2H', '3D', '4C', '5S'], labels: ['A♠', '2♥', '3♦', '4♣', '5♠'] },
  { id: 'deuce_to_seven_triple_draw', alias: 'D01', cards: ['2S', '3H', '4D', '7C', '8S'], labels: ['2♠', '3♥', '4♦', '7♣', '8♠'] },
];
for (const game of games) test(`${game.id}: review to practice, named setup persistence, reload and removal`, async ({ page: initialPage }, info) => {
  let page = initialPage;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/learn');
  await page.evaluate(game => {
    const hand = { handId: 'transfer-hand', variantId: game.alias, startedAt: 10, seats: [{ seat: 0, isHero: true, initialHand: game.cards, hand: ['KS'] }] };
    localStorage.setItem('mgx.handReviews.v1', JSON.stringify({ version: 1, entries: [{ key: JSON.stringify(['', hand.handId, 10, game.id]), hand, note: 'Keep this note', tags: ['draw'] }] }));
    localStorage.setItem('badugi.history.hands', '[]');
    localStorage.setItem('badugi_player_stats_v1', JSON.stringify({ gamesPlayed: 17, winnings: 120 }));
  }, game);
  const before = await page.evaluate(() => ({ ...localStorage }));
  await page.goto('/learn/review');
  await page.getByTestId('saved-hand').locator('summary').click();
  await page.getByRole('link', { name: 'この開始手札で練習', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '種目', exact: true })).toHaveValue(game.id);
  await expect(page.getByTestId('practice-table')).toHaveCount(0);
  await page.reload();
  for (const card of game.labels) await expect(page.getByRole('button', { name: card, exact: true })).toHaveAttribute('aria-pressed', 'true');
  const longName = '交換の判断を繰り返し練習する条件'.repeat(3);
  await page.getByLabel('練習条件の名前').fill(longName);
  await page.getByRole('button', { name: '現在の条件を保存' }).click();
  await expect(page.getByRole('status')).toContainText('練習条件を保存しました');
  const first = await page.evaluate(() => JSON.parse(localStorage.getItem('mgx.practicePresets.v1')!).entries[0]);
  await page.getByLabel('練習条件の名前').fill('残す条件');
  await page.getByRole('button', { name: '現在の条件を保存' }).click();
  // Exercise in-app navigation, then reopen in a fresh tab to verify storage
  // independently of component state. Bundled WebKit crashes on a second
  // hard navigation after pushState + reload, even with plain HTML.
  await page.getByRole('link', { name: '学習に戻る', exact: true }).click();
  await page.getByRole('link', { name: /開始手札を決めて練習する/ }).click();
  const reopened = await page.context().newPage();
  await reopened.goto('/learn/practice');
  await page.close();
  page = reopened;
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('combobox', { name: '種目', exact: true }).selectOption(game.id === 'badugi' ? 'ace_to_five_triple_draw' : 'badugi');
  await page.getByLabel('保存した練習条件').selectOption(first.id);
  await page.getByRole('button', { name: 'この条件を呼び出す' }).click();
  await expect(page.getByRole('combobox', { name: '種目', exact: true })).toHaveValue(game.id);
  for (const card of game.labels) await expect(page.getByRole('button', { name: card, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('practice-table')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('loaded-practice-setup.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: '保存した条件を削除' }).click();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mgx.practicePresets.v1')!).entries.length)).toBe(2);
  await page.getByRole('button', { name: '保存した条件を削除' }).click();
  await page.getByRole('button', { name: '削除する', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mgx.practicePresets.v1')!).entries.map(entry => entry.name))).toEqual(['残す条件']);
  await page.getByRole('button', { name: 'この手札で練習する' }).click();
  await expect(page.getByTestId('practice-hero-hand').getByRole('button')).toHaveText(game.labels);
  await page.getByRole('button', { name: '条件を変更' }).click();
  const after = await page.evaluate(() => { const values = { ...localStorage }; delete values['mgx.practicePresets.v1']; return values; });
  expect(after).toEqual(before);
  expect(errors).toEqual([]);
});

test('English unsupported and missing records, invalid URL, and saved setup loading', async ({ page }) => {
  await page.goto('/learn');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('en');
  await page.evaluate(() => {
    const entries = ['stud', 'badugi'].map(variantId => {
      const hand = { handId: variantId, variantId, seats: [{ seat: 0, hand: ['AS', '2H', '3D', '4C'] }] };
      return { key: JSON.stringify(['', hand.handId, 0, variantId]), hand, note: '', tags: [] };
    });
    localStorage.setItem('mgx.handReviews.v1', JSON.stringify({ version: 1, entries }));
  });
  await page.goto('/learn/review');
  for (const row of await page.getByTestId('saved-hand').all()) await row.locator('summary').click();
  await expect(page.getByText(/This game is not supported yet/)).toBeVisible();
  await expect(page.getByText(/Your complete starting hand is unavailable/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Practice this starting hand', exact: true })).toHaveCount(0);
  await page.goto('/learn/practice?variant=badugi&cards=AS,AS,3D,4C');
  await expect(page.getByRole('alert')).toContainText('Could not load this setup');
  await expect(page.getByRole('button', { name: 'Practice this hand', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Game', exact: true }).selectOption('ace_to_five_triple_draw');
  await page.getByLabel('Setup name').fill('English setup');
  await page.getByRole('button', { name: 'Save current setup', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Practice setup saved.');
  await page.reload();
  await page.getByLabel('Saved practice setups').selectOption({ label: 'English setup' });
  await page.getByRole('button', { name: 'Load this setup', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Practice this hand', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('unreadable setup storage is preserved and practice remains available', async ({ page }) => {
  await page.goto('/learn/practice');
  await page.evaluate(() => localStorage.setItem('mgx.practicePresets.v1', '{broken'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('保存した練習条件を読み込めません');
  await page.getByLabel('練習条件の名前').fill('保存できない条件');
  await expect(page.getByRole('button', { name: '現在の条件を保存' })).toBeDisabled();
  await page.getByRole('button', { name: 'この手札で練習する' }).click();
  await expect(page.getByTestId('practice-table')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('mgx.practicePresets.v1'))).toBe('{broken');
});
