import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { clickHeroAction } from './helpers/clickHeroAction';

const games = ['B03', 'B04', 'D04', 'D05', 'D06', 'D07', 'S03', 'S04', 'S05', 'S06', 'S07'];
const variants = [
  'super_holdem', 'fl_super_holdem', 'badeucey_triple_draw',
  'badacey_triple_draw', 'hidugi_triple_draw', 'archie_triple_draw',
  'five_card_single_draw', 'badugi_single_draw', 'badeucey_single_draw',
  'badacey_single_draw', 'hidugi_single_draw',
];

test('release-candidate cash MIX rotates through all 11 games with real fold and next-hand controls', async ({ page }, info) => {
  test.skip(process.env.MGX_CANDIDATE_MIX_QA !== '1', 'Explicit release-candidate MIX QA');
  test.setTimeout(10 * 60_000);
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const expectedCommit = process.env.MGX_EXPECTED_SERVED_COMMIT;
  const release = await page.request.get('/release.json');
  expect(release.ok()).toBe(true);
  const baseURL = new URL(release.url()).origin;
  const servedCommit = (await release.json()).commit;
  console.log('[CANDIDATE_MIX] release', info.project.name, release.url(), baseURL, servedCommit);
  expect(servedCommit).toBe(expectedCommit);
  expect(sourceCommit).toBe(servedCommit);

  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({
    json: route.request().url().includes('/auth/me')
      ? { id: 'mix-qa', username: 'Mix QA' }
      : {},
  }));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  console.log('[CANDIDATE_MIX] origin', info.project.name, page.url());
  await page.evaluate((selectedGameIds) => {
    localStorage.setItem('mgx_auth', JSON.stringify({
      accessToken: 'local-qa', user: { id: 'mix-qa', username: 'Mix QA' },
    }));
    localStorage.setItem('mgx.tournament.v2', JSON.stringify({
      version: 2,
      tournament: { stageWins: {}, completedTournaments: [], history: [] },
      career: { statistics: {}, worldChampionship: { cleared: true } },
      rivals: {}, _meta: {},
    }));
    localStorage.setItem('mgx.previewVariants', 'true');
    localStorage.setItem('mixedGameProfiles', JSON.stringify([{
      id: 'qa-candidate-mix', name: 'Candidate MIX', selectedGameIds,
      handsPerGame: 1, selectionMode: 'FIXED', allowDuplicates: true,
    }]));
  }, games);
  await page.goto(`${baseURL}/mixed?preset=qa-candidate-mix`, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: info.outputPath('builder-before-start.png') });
  console.log('[CANDIDATE_MIX] builder', info.project.name, page.url(),
    (await page.locator('body').innerText()).slice(0, 300), 'errors', errors);
  await expect(page.getByRole('heading', { name: 'ミックスローテーションを作成' }))
    .toBeVisible({ timeout: 10_000 });
  const startButton = page.getByRole('button', { name: /Mixed Game 開始|Start Mixed Game/i });
  await expect(startButton).toBeEnabled({ timeout: 10_000 });
  await startButton.click();
  await expect(page.getByTestId('mixed-rotation-status')).toBeVisible();

  const snapshots: Array<{ game: string; handId: string; dealer: number; chips: number }> = [];
  let names: string[] | null = null;
  for (let index = 0; index < variants.length; index++) {
    console.log('[CANDIDATE_MIX] start', info.project.name, index + 1, variants[index]);
    await expect.poll(async () => page.evaluate(() => window.__BADUGI_E2E__?.getStateSnapshot()?.gameVariant))
      .toBe(variants[index]);
    const start = await page.evaluate(() => window.__BADUGI_E2E__.getStateSnapshot());
    if (names === null) names = start.players.map(player => player.name);
    expect(start.players.map(player => player.name)).toEqual(names);
    expect(start.dealerIdx).toBeGreaterThanOrEqual(0);
    expect(start.dealerIdx).toBeLessThan(6);
    expect(start.players[start.dealerIdx].stack).toBeGreaterThan(0);
    if ([0, 7, 10].includes(index)) {
      if (await page.getByTestId('mobile-play-layout').count()) {
        const phaseFits = await page.locator('.mgx-game-context > span').first()
          .evaluate(element => element.scrollWidth <= element.clientWidth + 1);
        expect(phaseFits, 'the current phase must remain readable in MIX').toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
          .toBe(true);
      }
      await page.screenshot({ path: info.outputPath(`rotation-${index + 1}-${variants[index]}.png`) });
    }

    const deadline = Date.now() + 60_000;
    while (!(await page.getByTestId('hand-result-overlay').isVisible()) && Date.now() < deadline) {
      const fold = page.getByTestId('action-fold');
      if (await fold.isVisible() && await fold.isEnabled()) {
        await clickHeroAction(page, 'action-fold');
      }
      expect(errors).toEqual([]);
      await page.waitForTimeout(100);
    }
    await expect(page.getByTestId('hand-result-overlay')).toBeVisible();
    const settled = await page.evaluate(() => window.__BADUGI_E2E__.getStateSnapshot());
    const chips = settled.players.reduce((sum, player) => sum + player.stack, 0);
    expect(chips).toBe(3000);
    const history = await page.evaluate(() => window.__BADUGI_E2E__.getHandHistory());
    const record = history.find(hand => hand.handId === settled.handId);
    expect(record).toBeTruthy();
    expect([variants[index], games[index]]).toContain(
      record.variantId ?? record.gameVariant ?? record.gameId,
    );
    snapshots.push({ game: settled.gameVariant, handId: settled.handId, dealer: settled.dealerIdx, chips });
    console.log('[CANDIDATE_MIX] complete', info.project.name, index + 1, settled.handId);
    if (index < variants.length - 1) {
      await page.getByTestId('hand-result-next-hand').click();
      await expect.poll(async () => page.evaluate(() => window.__BADUGI_E2E__?.getStateSnapshot()?.handCount))
        .toBe(index + 2);
    }
  }
  expect(snapshots.map(snapshot => snapshot.game)).toEqual(variants);
  expect(new Set(snapshots.map(snapshot => snapshot.handId)).size).toBe(variants.length);
  expect(errors).toEqual([]);

  const reportPath = path.resolve(
    process.env.MGX_CANDIDATE_MIX_REPORT_DIR ?? 'reports/release-candidate-mix',
    `${info.project.name}.json`,
  );
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify({
    sourceCommit, servedCommit, project: info.project.name,
    viewport: page.viewportSize(), apiStubbed: true,
    actions: 'real fold and next-hand buttons', snapshots, errors,
  }, null, 2));
});
