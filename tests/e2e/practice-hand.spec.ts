import { test, expect, type Page } from '@playwright/test';
const games = [
  { id: 'badugi', cards: ['A♠', '2♥', '3♦', '3♣'] },
  { id: 'ace_to_five_triple_draw', cards: ['A♠', '2♥', '3♦', '4♣', 'K♥'] },
  { id: 'deuce_to_seven_triple_draw', cards: ['2♠', '3♥', '4♦', '7♣', 'K♥'] },
];
async function finish(page: Page) {
  const result = page.getByTestId('practice-result');
  for (let i = 0; i < 70; i++) {
    const action = page.getByRole('button', { name: /^(チェック|コール \d+|0枚交換する)$/ }).first();
    await expect(result.or(action)).toBeVisible({ timeout: 15000 });
    if (await result.isVisible()) return;
    if ((await action.textContent())?.includes('枚交換')) {
      await page.getByTestId('practice-hero-hand').getByRole('button').first().click();
      await page.getByRole('button', { name: '1枚交換する', exact: true }).click();
    } else await action.click();
  }
  throw new Error('Practice hand did not finish');
}
for (const game of games) test(`${game.id}: play selected cards, repeat, save, and keep regular statistics unchanged`, async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/learn');
  await page.getByRole('link', { name: /開始手札を決めて練習する/ }).click();
  await page.getByRole('combobox', { name: '種目', exact: true }).selectOption(game.id);
  await page.getByRole('button', { name: '選択をクリア' }).click();
  await expect(page.getByRole('button', { name: 'この手札で練習する' })).toBeDisabled();
  for (const card of game.cards) await page.getByRole('button', { name: card, exact: true }).click();
  await page.evaluate(() => {
    localStorage.setItem('badugi.history.hands', JSON.stringify([{ handId: 'regular-history', variantId: 'badugi', ts: 1 }]));
    localStorage.setItem('badugi_player_stats_v1', JSON.stringify({ gamesPlayed: 12, vpip: 0.3, pfr: 0.2, winnings: 100 }));
  });
  const before = await page.evaluate(() => ({ ...localStorage }));
  if (game.id === 'badugi') await page.screenshot({ path: info.outputPath('practice-setup.png'), fullPage: true });
  await page.getByRole('button', { name: 'この手札で練習する' }).click();
  await expect(page.getByTestId('practice-mode-notice')).toContainText('通常の対局成績には反映されません');
  await expect(page.getByTestId('practice-hero-hand').getByRole('button')).toHaveText(game.cards);
  await expect(page.getByTestId('practice-cpu-1')).toContainText('▧');
  await page.screenshot({ path: info.outputPath(`${game.id}-practice.png`), fullPage: true });
  await finish(page);
  await expect(page.getByTestId('practice-result')).toContainText('勝者');
  await page.screenshot({ path: info.outputPath(`${game.id}-result.png`), fullPage: true });
  await page.getByTestId('practice-result').getByRole('button', { name: 'あとで復習に保存' }).click();
  await expect(page.getByRole('button', { name: '復習に保存済み' })).toBeDisabled();
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('mgx.handReviews.v1')!).entries[0].hand);
  expect(record.mode).toBe('practice');
  expect(record.variantId).toBe(game.id);
  expect(record.events.some(event => event.type === 'DRAW_ACTION')).toBe(true);
  expect(record.seats.reduce((sum, seat) => sum + seat.endStack, 0)).toBe(12000);
  await page.getByRole('button', { name: '同じ開始手札でもう一度' }).click();
  await expect(page.getByTestId('practice-result')).toHaveCount(0);
  await expect(page.getByTestId('practice-hero-hand').getByRole('button')).toHaveText(game.cards);
  const after = await page.evaluate(() => { const all = { ...localStorage }; delete all['mgx.handReviews.v1']; delete all['mgx.learningProgress.v1']; return all; });
  expect(after).toEqual(before);
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mgx.learningProgress.v1')!).practices).length)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: '条件を変更' }).click();
  await expect(page.getByRole('button', { name: 'この手札で練習する' })).toBeVisible();
  await page.goto('/learn/review');
  await expect(page.getByTestId('saved-hand')).toContainText('配牌練習');
  await page.getByTestId('saved-hand').locator('summary').click();
  await expect(page.getByRole('heading', { name: '自分の最初の手札' })).toBeVisible();
  await page.getByRole('link', { name: '学習に戻る', exact: true }).click();
  await expect(page.getByTestId('learning-totals')).toContainText(/練習完了\s*1/);
  expect(errors).toEqual([]);
});

test('practice setup works in English and refuses incomplete selections', async ({ page }) => {
  await page.goto('/learn');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('en');
  await page.getByRole('link', { name: /Practice a starting hand/ }).click();
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await page.getByRole('button', { name: 'A♠', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Practice this hand' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Game', exact: true }).selectOption('deuce_to_seven_triple_draw');
  await page.getByRole('button', { name: 'Practice this hand' }).click();
  await expect(page.getByTestId('practice-mode-notice')).toContainText('Does not affect ratings');
  await page.getByRole('button', { name: 'Change setup' }).click();
  await expect(page.getByRole('button', { name: 'Practice this hand' })).toBeEnabled();
});
