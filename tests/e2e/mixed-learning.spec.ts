import { clickHeroAction } from './helpers/clickHeroAction';
import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, games: string[], handsPerGame = 1, hardBans = '') {
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/auth/me') ? { id: 'mix-qa', username: 'Mix QA' } : {} }));
  await page.addInitScript(({ games, handsPerGame }) => {
    localStorage.setItem('mgx_auth', JSON.stringify({ accessToken: 'local-qa', user: { id: 'mix-qa', username: 'Mix QA' } }));
    localStorage.setItem('mgx.tournament.v2', JSON.stringify({ version: 2, tournament: { stageWins: {}, completedTournaments: [], history: [] }, career: { statistics: {}, worldChampionship: { cleared: true } }, rivals: {}, _meta: {} }));
    localStorage.setItem('mixedGameProfiles', JSON.stringify([{ id: 'qa-mix', name: 'QA Mix', selectedGameIds: games, handsPerGame, selectionMode: 'FIXED', allowDuplicates: true }]));
  }, { games, handsPerGame });
  await page.goto('/mixed?preset=qa-mix');
  if (hardBans) await page.getByRole('textbox', { name: '必ず除外する種目' }).fill(hardBans);
  await page.getByRole('button', { name: 'Mixed Game 開始', exact: true }).click();
  await expect(page.getByTestId('mixed-rotation-status')).toBeVisible();
}
async function snapshot(page: Page) { return page.evaluate(() => (window as any).__BADUGI_E2E__.getStateSnapshot()); }
async function finishHand(page: Page) {
  for (let i = 0; i < 80; i++) {
    const state = await snapshot(page);
    if (['SHOWDOWN', 'HAND_RESULT', 'WAITING_NEXT_HAND'].includes(state.phase)) return state;
    await page.evaluate(() => {
      const api = (window as any).__BADUGI_E2E__;
      const state = api.getStateSnapshot();
      if (typeof state.turn !== 'number') return;
      if (state.gameVariant === 'badugi') api.forceSeatAction(state.turn, { type: state.phase === 'DRAW' ? 'draw' : 'fold', cards: [] });
      else api.forceControllerAction(state.turn, { type: state.phase === 'DRAW' ? 'draw' : 'fold', cards: [] });
    });
    await page.waitForTimeout(40);
  }
  throw new Error(`Hand did not end: ${JSON.stringify(await snapshot(page))}`);
}

test('cash MIX crosses draw, stud and board families with chips, seats and button intact', async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const games = ['D02', 'D01', 'D03', 'ST1', 'B01', 'B05'];
  const variants = ['ace_to_five_triple_draw', 'deuce_to_seven_triple_draw', 'badugi', 'stud', 'nlh', 'plo'];
  await setup(page, games);
  let names: string[] = [];
  for (let i = 0; i < 8; i++) {
    const state = await snapshot(page);
    expect(state.gameVariant).toBe(variants[i % variants.length]);
    expect(state.dealerIdx).toBe(i % 6);
    if (!i) names = state.players.map(p => p.name);
    expect(state.players.map(p => p.name)).toEqual(names);
    if (i === 3) {
      await expect(page.getByTestId('mixed-rotation-status')).toBeVisible();
      const mobile = await page.getByTestId('mobile-play-layout').count();
      const phase = page.getByTestId(mobile ? 'table-phase-badge' : 'phase-compact-strip');
      await expect(phase).toContainText(mobile ? '3番街' : '3rd Street');
      await expect(phase).not.toContainText('D1');
      for (let seat = 1; seat < 6; seat++) {
        if (mobile) {
          await expect(page.getByTestId(`player-${seat}-card-2`)).toBeVisible();
          await expect(page.getByTestId(`player-${seat}-card-2`)).not.toHaveAttribute('aria-label', '伏せ札');
          await expect(page.getByTestId(`player-${seat}-card-0`)).toHaveAttribute('aria-label', '伏せ札');
        } else {
          await expect(page.getByTestId(`player-${seat}-card-2-up-slot`)).toBeVisible();
          await expect(page.getByTestId(`player-${seat}-card-0-down-slot`)).toBeVisible();
        }
        await expect(page.getByTestId(`seat-${seat}-draw-badge`)).toHaveCount(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const overlappingSeats = await page.evaluate(() => {
        const boxes = Array.from({ length: 6 }, (_, i) => document.querySelector(`[data-testid="seat-${i}"]`)!.getBoundingClientRect());
        return boxes.some((a, i) => boxes.slice(i + 1).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1));
      });
      expect(overlappingSeats).toBe(false);
      await page.mouse.move(0, 0);
      await expect(page.locator('[data-testid^="seat-"][data-testid$="-detail"]')).toHaveCount(0);
      await page.screenshot({ path: info.outputPath('mix-stud.png') });
    }
    const settled = await finishHand(page);
    expect(settled.players.reduce((sum, p) => sum + p.stack, 0)).toBe(3000);
    await page.evaluate(() => (window as any).__BADUGI_E2E__.dealNewHandNow());
    await expect.poll(async () => (await snapshot(page)).handCount).toBe(i + 2);
    // The roster ref advances before React publishes the new controller's
    // pot. Wait for both views of the same hand before checking chips.
    await expect.poll(async () => {
      const state = await snapshot(page);
      const controllerPot = state.controllerSnapshot?.pot;
      return typeof controllerPot !== 'number' || state.potTotal === controllerPot;
    }).toBe(true);
    const next = await snapshot(page);
    expect(next.gameVariant).toBe(variants[(i + 1) % variants.length]);
    const records = await page.evaluate(() => (window as any).__BADUGI_E2E__.getHandHistory());
    const record = records.find(record => record.handId === settled.handId);
    expect(record, `history for ${settled.handId}`).toBeTruthy();
    expect([variants[i % variants.length], games[i % games.length]]).toContain(record.variantId ?? record.gameVariant ?? record.gameId);
    // A CPU may act before this snapshot. Its committed chips have already
    // moved into the pot, so compare the whole table rather than seat stacks.
    expect(next.players.reduce((sum, p) => sum + p.stack, 0) + next.potTotal)
      .toBe(settled.players.reduce((sum, p) => sum + p.stack, 0));
  }
  expect(errors).toEqual([]);
});


test('MIX observes hand limits, skips unreleased variants and ignores repeated next-hand requests', async ({ page }) => {
  await setup(page, ['D04', 'ST1', 'D02', 'D01'], 2, 'st1 b05');
  await expect(page.getByTestId('mixed-rotation-status')).toContainText('1/2');
  expect((await snapshot(page)).gameVariant).toBe('ace_to_five_triple_draw');
  await page.evaluate(() => (window as any).__BADUGI_E2E__.dealNewHandNow());
  expect((await snapshot(page)).handCount).toBe(1);
  for (let i = 0; i < 4; i++) {
    await finishHand(page);
    await page.evaluate(() => { const api = (window as any).__BADUGI_E2E__; api.dealNewHandNow(); api.dealNewHandNow(); });
    await expect.poll(async () => (await snapshot(page)).handCount).toBe(i + 2);
    await page.waitForTimeout(220);
    expect((await snapshot(page)).handCount).toBe(i + 2);
    expect((await snapshot(page)).gameVariant).toBe(i === 1 || i === 2 ? 'deuce_to_seven_triple_draw' : 'ace_to_five_triple_draw');
  }
});

test('a duplicate Next request cannot carry into a quickly completed following hand', async ({ page }) => {
  await setup(page, ['D02', 'D01'], 2);
  await finishHand(page);
  // Hold the 100ms dealing lock while a second hand settles, reproducing the
  // stale queued click that otherwise depends on WebKit scheduling speed.
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.evaluate(() => {
    const api = (window as any).__BADUGI_E2E__;
    api.dealNewHandNow();
    api.dealNewHandNow();
  });
  await expect.poll(async () => (await snapshot(page)).handCount).toBe(2);
  await finishHand(page);
  await page.clock.runFor(250);
  expect((await snapshot(page)).handCount).toBe(2);
  expect((await snapshot(page)).gameVariant).toBe('ace_to_five_triple_draw');
  await page.evaluate(() => (window as any).__BADUGI_E2E__.dealNewHandNow());
  await expect.poll(async () => (await snapshot(page)).handCount).toBe(3);
  expect((await snapshot(page)).gameVariant).toBe('deuce_to_seven_triple_draw');
  // A genuine next-hand request after this short result must still be queued
  // until the dealing lock clears, and duplicate requests must coalesce.
  await finishHand(page);
  await page.evaluate(() => {
    const api = (window as any).__BADUGI_E2E__;
    api.dealNewHandNow(); api.dealNewHandNow();
  });
  expect((await snapshot(page)).handCount).toBe(3);
  await page.clock.runFor(250);
  expect((await snapshot(page)).handCount).toBe(4);
});

test('quiz supports answers, six-question scoring, retry and topic switching', async ({ page }, info) => {
  await page.addInitScript(() => { Math.random = () => 0.999; });
  await page.goto('/learn');
  await page.getByRole('link', { name: /クイズでルールを確認する/ }).click();
  await page.getByRole('combobox', { name: '練習テーマ' }).selectOption('badugi');
  await page.getByRole('button', { name: '1枚', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('正解：4枚');
  await expect(page.getByRole('button', { name: '4枚', exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('quiz-feedback.png'), fullPage: true });
  await page.getByRole('button', { name: '次の問題' }).click();
  for (const [index, choice] of ['1枚', '3枚', '3枚', '2枚', '4枚'].entries()) {
    await page.getByRole('button', { name: choice, exact: true }).click();
    await page.getByRole('button', { name: index === 4 ? '結果を見る' : '次の問題' }).click();
  }
  await expect(page.getByText('5 / 6', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '間違えた問題だけ復習' }).click();
  await expect(page.getByText('1 / 1', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: '練習テーマ' }).selectOption('low8');
  await page.getByRole('button', { name: 'ロー成立', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('正解：ロー成立');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});


test('cash MIX includes Big O and all six Dramaha games through real hand controls', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const games = ['B07', 'H01', 'H02', 'H03', 'H04', 'H05', 'H06'];
  const variants = ['big_o', 'dramaha_hi', 'dramaha_27', 'dramaha_a5', 'dramaha_zero', 'dramaha_hidugi', 'dramaha_badugi'];
  await setup(page, games);
  let names: string[] = [];
  for (let index = 0; index < 8; index++) {
    await expect.poll(async () => (await snapshot(page)).gameVariant).toBe(variants[index % variants.length]);
    const current = await snapshot(page);
    if (!index) names = current.players.map(player => player.name);
    expect(current.players.map(player => player.name)).toEqual(names);
    const deadline = Date.now() + 60000;
    while (!(await page.getByTestId('hand-result-overlay').isVisible()) && Date.now() < deadline) {
      const fold = page.getByTestId('action-fold');
      if (await fold.isVisible() && await fold.isEnabled()) await clickHeroAction(page, 'action-fold');
      expect(errors).toEqual([]);
      await page.waitForTimeout(100);
    }
    await expect(page.getByTestId('hand-result-overlay')).toBeVisible();
    const settled = await snapshot(page);
    expect(settled.players.reduce((sum, player) => sum + player.stack, 0)).toBe(3000);
    if (index < 7) await page.getByTestId('hand-result-next-hand').click();
  }
  expect(errors).toEqual([]);
});
