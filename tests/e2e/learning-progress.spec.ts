import { test, expect } from '@playwright/test';

test('today links connect missed quizzes, pending reviews and saved practice across reloads', async ({ page }, info) => {
  await page.addInitScript(() => { Math.random = () => 0.999; });
  await page.goto('/learn');
  await page.evaluate(() => {
    const hand = { handId: 'progress-review', variantId: 'badugi', startedAt: 10, seats: [{ seat: 0, initialHand: ['AS', '2H', '3D', '4C'] }] };
    localStorage.setItem('mgx.handReviews.v1', JSON.stringify({ version: 1, entries: [{ key: JSON.stringify(['', hand.handId, 10, 'badugi']), hand, note: 'Keep my notes', tags: [] }] }));
    localStorage.setItem('mgx.practicePresets.v1', JSON.stringify({ version: 1, entries: [{ id: 'saved', name: '毎日の4枚練習', variant: 'badugi', cards: ['AS', '2H', '3D', '4C'] }] }));
    localStorage.setItem('badugi.history.hands', '[]');
    localStorage.setItem('badugi_player_stats_v1', '{"gamesPlayed":8}');
  });
  await page.reload();
  const before = await page.evaluate(() => ({ ...localStorage }));
  await page.getByRole('link', { name: /クイズでルールを確認する/ }).click();
  await page.getByLabel('練習テーマ').selectOption('badugi');
  await page.getByRole('button', { name: '1枚', exact: true }).click();
  await expect(page.getByRole('button', { name: '4枚', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: '学習に戻る', exact: true }).click();
  await expect(page.getByTestId('learning-totals')).toContainText('0%');
  await page.getByRole('link', { name: /間違えたクイズを復習（1問）/ }).click();
  await expect(page.getByText('1 / 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '4枚', exact: true }).click();
  await page.getByRole('button', { name: '結果を見る' }).click();
  await page.getByRole('link', { name: '学習に戻る', exact: true }).click();
  await expect(page.getByTestId('learning-totals')).toContainText('50%');
  await expect(page.getByRole('link', { name: /間違えたクイズを復習/ })).toHaveCount(0);
  await page.getByRole('link', { name: /未復習のハンドを振り返る/ }).click();
  await page.getByTestId('saved-hand').locator('summary').click();
  await page.getByRole('button', { name: '復習済みにする', exact: true }).click();
  await expect(page.getByTestId('saved-hand')).toHaveCount(0);
  await page.getByLabel('復習状況').selectOption('done');
  await page.getByTestId('saved-hand').locator('summary').click();
  await expect(page.getByRole('button', { name: '復習済み・未復習に戻す' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: '学習に戻る', exact: true }).click();
  await expect(page.getByTestId('learning-totals')).toContainText('1/1');
  await expect(page.getByTestId('learning-today')).toContainText('回答 2問・復習 1件');
  await page.screenshot({ path: info.outputPath('learning-today.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  // Reopen a fresh tab: avoids the bundled WebKit repeated-history navigation crash.
  const fresh = await page.context().newPage();
  await fresh.goto('/learn');
  await expect(fresh.getByTestId('learning-totals')).toContainText('50%');
  await expect(fresh.getByTestId('learning-totals')).toContainText('1/1');
  await fresh.getByRole('link', { name: /保存条件「毎日の4枚練習」/ }).click();
  for (const label of ['A♠', '2♥', '3♦', '4♣']) await expect(fresh.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(fresh.getByTestId('practice-table')).toHaveCount(0);
  const after = await fresh.evaluate(() => { const data = { ...localStorage }; delete data['mgx.learningProgress.v1']; return data; });
  expect(after).toEqual(before);
});

test('new game-switching questions score correctly in Japanese and English', async ({ page }, info) => {
  await page.addInitScript(() => { Math.random = () => 0.999; });
  await page.goto('/learn');
  await page.getByRole('link', { name: '種目切り替えのルールを6問' }).click();
  for (const [index, choice] of ['3回', '1回', '交換せず手札を維持する', '4枚', 'ランクもスートもすべて異なる', '弱くならない'].entries()) {
    await page.getByRole('button', { name: choice, exact: true }).click();
    await expect(page.getByRole('status')).toContainText('正解');
    if (index === 0) await page.screenshot({ path: info.outputPath('draw-rule-question.png'), fullPage: true });
    await page.getByRole('button', { name: index === 5 ? '結果を見る' : '次の問題', exact: true }).click();
  }
  await expect(page.getByText('6 / 6', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '学習に戻る', exact: true }).click();
  await expect(page.getByTestId('learning-totals')).toContainText('100%');
  await page.getByLabel('Language').selectOption('en');
  await expect(page.getByRole('heading', { name: 'What to study today' })).toBeVisible();
  await page.getByRole('link', { name: 'Six game-switching rule questions' }).click();
  await page.getByRole('button', { name: 'Three', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Correct');
});

test('corrupt progress is not replaced, and a failed answer can be saved again', async ({ page }) => {
  await page.goto('/learn');
  await page.evaluate(() => localStorage.setItem('mgx.learningProgress.v1', '{broken'));
  await page.reload();
  await expect(page.getByTestId('learning-dashboard').getByRole('alert')).toContainText('読み込めません');
  await expect(page.getByTestId('learning-totals')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('mgx.learningProgress.v1'))).toBe('{broken');
  // Test fixture recovery, then simulate quota errors only for the dedicated progress store.
  await page.evaluate(() => {
    localStorage.removeItem('mgx.learningProgress.v1');
    window.dispatchEvent(new StorageEvent('storage', { key: 'mgx.learningProgress.v1' }));
    const set = Storage.prototype.setItem;
    (window as any).restoreStorage = () => { Storage.prototype.setItem = set; };
    Storage.prototype.setItem = function (key, value) { if (key === 'mgx.learningProgress.v1') throw new Error('quota'); set.call(this, key, value); };
  });
  await page.getByRole('link', { name: /クイズでルールを確認する/ }).click();
  await page.getByLabel('練習テーマ').selectOption('badugi');
  await page.getByRole('button', { name: '1枚', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('進捗を保存できませんでした');
  await page.evaluate(() => (window as any).restoreStorage());
  await page.getByRole('button', { name: '進捗の保存を再試行' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mgx.learningProgress.v1')!).answers).length)).toBe(1);
});
