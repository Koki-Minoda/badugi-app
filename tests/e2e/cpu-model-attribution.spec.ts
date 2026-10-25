import { expect, test, type Page } from '@playwright/test';

async function finishForcedBadugiHand(page: Page) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const state = await page.evaluate(() => (window as any).__BADUGI_E2E__.getStateSnapshot());
    if (['SHOWDOWN', 'HAND_RESULT', 'WAITING_NEXT_HAND'].includes(state.phase)) return;
    await page.evaluate(() => {
      const api = (window as any).__BADUGI_E2E__;
      const state = api.getStateSnapshot();
      if (typeof state.turn === 'number') {
        api.forceSeatAction(state.turn, { type: state.phase === 'DRAW' ? 'draw' : 'fold', cards: [] });
      }
    });
    await page.waitForTimeout(40);
  }
  throw new Error('Forced Badugi hand did not end');
}

test('saved hand does not claim a model for forced CPU actions', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({
    json: route.request().url().includes('/auth/me')
      ? { id: 'model-attribution-qa', username: 'Model Attribution QA' }
      : {},
  }));
  await page.addInitScript(() => {
    localStorage.setItem('mgx_auth', JSON.stringify({
      accessToken: 'local-qa',
      user: { id: 'model-attribution-qa', username: 'Model Attribution QA' },
    }));
    localStorage.setItem('mgx.tournament.v2', JSON.stringify({
      version: 2,
      tournament: { stageWins: {}, completedTournaments: [], history: [] },
      career: { statistics: {}, worldChampionship: { cleared: true } },
      rivals: {},
      _meta: {},
    }));
    localStorage.setItem('mixedGameProfiles', JSON.stringify([{
      id: 'qa-badugi-model',
      name: 'QA Badugi Model',
      selectedGameIds: ['D03'],
      handsPerGame: 1,
      selectionMode: 'FIXED',
      allowDuplicates: true,
    }]));
  });
  await page.goto('/mixed?preset=qa-badugi-model');
  await page.getByRole('button', { name: 'Mixed Game 開始', exact: true }).click();
  await expect(page.getByTestId('mixed-rotation-status')).toBeVisible();
  await finishForcedBadugiHand(page);
  await expect(page.getByTestId('hand-result-overlay')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const text = localStorage.getItem('rl_hand_histories_v1') ?? '';
    const latest = text.trim().split('\n').filter(Boolean).at(-1);
    return latest ? JSON.parse(latest) : null;
  })).not.toBeNull();
  const record = await page.evaluate(() => {
    const lines = (localStorage.getItem('rl_hand_histories_v1') ?? '').trim().split('\n').filter(Boolean);
    return JSON.parse(lines.at(-1)!);
  });
  expect(record.variantId).toBe('D03');
  expect(record.players.filter((player: any) => player.isCPU)).not.toHaveLength(0);
  expect(record.players.filter((player: any) => player.isCPU).map((player: any) => player.cpuModelId))
    .toEqual([null, null, null, null, null]);
  expect(record.humanBenchmark.cpuModelId).toBeNull();
});
