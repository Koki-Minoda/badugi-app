import { expect, test } from '@playwright/test';

const variants = ['nlh', 'razz', 'deuce_to_seven_triple_draw'];
const cues = ['高い役が勝ち', 'A-5ロー · Aは低い', '2-7ロー · Aは高い'];
const parts = [
  'game-table-surface', 'seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5',
  'table-total-pot', 'table-phase-badge', 'decision-panel', 'player-action-hint',
  'action-setting-slot', 'action-buttons-slot', 'action-fold', 'action-raise',
];

test('NLH, Razz and 2-7 share one readable iPhone table in both orientations', async ({ page }, info) => {
  test.setTimeout(120_000);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const geometries: Record<string, Record<string, number>>[] = [];
    for (const [index, variant] of variants.entries()) {
      await page.goto(`/game?trial=1&variant=${variant}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('mobile-play-layout')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('seat-0-name')).toHaveText('あなた');
      await expect(page.getByTestId('decision-panel')).toBeVisible();
      await expect(page.getByTestId('table-phase-badge')).toBeVisible();
      await expect(page.getByTestId('winning-hand-cue')).toHaveText(cues[index]);
      const geometry = await page.evaluate((ids) => {
        const result: Record<string, Record<string, number>> = {};
        for (const id of ids) {
          const element = document.querySelector(`[data-testid="${id}"]`);
          if (!element) throw new Error(`Missing shared table part: ${id}`);
          const box = element.getBoundingClientRect();
          result[id] = Object.fromEntries(
            ['x', 'y', 'width', 'height'].map(key => [key, Math.round(box[key as keyof DOMRect] as number)]),
          );
        }
        return result;
      }, parts);
      geometries.push(geometry);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
      const panel = geometry['decision-panel'];
      expect(panel.y).toBeGreaterThanOrEqual(0);
      expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({ path: info.outputPath(`${viewport.width}x${viewport.height}-${variant}.png`) });
    }
    for (const geometry of geometries.slice(1)) {
      for (const part of parts) expect(geometry[part], `${part} changed position between game families`).toEqual(geometries[0][part]);
    }
  }
});

test('guest Razz advances naturally to one clear Japanese result action', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/game?trial=1&variant=razz', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('mobile-play-layout')).toBeVisible({ timeout: 20_000 });
  const result = page.getByTestId('hand-result-overlay');
  let heroActions = 0;
  const deadline = Date.now() + 60_000;
  while (!(await result.isVisible()) && Date.now() < deadline) {
    for (const action of ['action-call', 'action-check']) {
      const button = page.getByTestId(action);
      if (await button.isVisible() && await button.isEnabled()) {
        await button.click();
        heroActions += 1;
        break;
      }
    }
    await page.waitForTimeout(150);
  }
  await expect(result).toBeVisible();
  expect(heroActions).toBeGreaterThan(0);
  await expect(page.getByTestId('hand-result-next-hand')).toHaveText('体験を終了・種目を選ぶ');
  await expect(page.getByTestId('hand-result-history')).toHaveCount(0);
  await expect(page.getByTestId('hand-result-cash-out')).toHaveCount(0);
  await expect(result.getByRole('button', { name: 'あとで復習に保存' })).toHaveCount(0);
  const resultText = await result.innerText();
  expect(resultText).not.toMatch(/A-5 LOW|2-7 LOW/);
});
