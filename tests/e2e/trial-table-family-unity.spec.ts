import { expect, test } from '@playwright/test';
import { APP_URL } from './authHelper';

const trialGameUrl = (variant: string) => new URL(
  `${process.env.E2E_APP_URL ? '' : 'dev/'}game?trial=1&variant=${variant}`,
  APP_URL,
).href;

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
      await page.goto(trialGameUrl(variant), { waitUntil: 'domcontentloaded' });
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

test('desktop table keeps winning rules and Japanese controls visible across families', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [variant, cue] of [
    ['nlh', '高い役が勝ち'],
    ['plo', '手札2枚＋場3枚 · 高い役'],
    ['razz', 'A-5ロー · Aは低い'],
    ['deuce_to_seven_triple_draw', '2-7ロー · Aは高い'],
  ]) {
    await page.goto(trialGameUrl(variant), { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('decision-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('winning-hand-cue')).toHaveText(cue);
    await expect(page.getByTestId('decision-panel')).toContainText('自分の操作');
    await expect(page.getByTestId('decision-panel')).toContainText('現在のベット');
    await expect(page.getByTestId('decision-panel')).not.toContainText('Waiting for');
  }
});

test('draw phase keeps the winning-hand cue visible beside the stand-pat action', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(trialGameUrl('deuce_to_seven_triple_draw'), { waitUntil: 'domcontentloaded' });
  const cue = page.getByTestId('winning-hand-cue');
  await expect(cue).toHaveText('2-7ロー · Aは高い');
  const drawButton = page.getByTestId('action-draw-selected');
  const deadline = Date.now() + 40_000;
  while (!(await drawButton.isVisible()) && Date.now() < deadline) {
    let clicked = false;
    for (const id of ['action-check', 'action-call']) {
      const button = page.getByTestId(id);
      if (await button.isVisible() && await button.isEnabled()) {
        await button.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) await page.waitForTimeout(100);
  }
  await expect(drawButton).toBeVisible();
  await expect(cue).toHaveText('2-7ロー · Aは高い');
  await expect(drawButton).toContainText('交換しない');
});

test('1024px desktop keeps the actual betting buttons and amount input on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(trialGameUrl('nlh'), { waitUntil: 'domcontentloaded' });
  const primary = page.locator('[data-testid="action-call"], [data-testid="action-check"]').first();
  await expect(primary).toBeVisible({ timeout: 20_000 });
  const panel = await page.getByTestId('decision-panel').boundingBox();
  expect(panel).not.toBeNull();
  for (const id of ['action-fold', 'action-raise', 'bet-size-input']) {
    const control = page.getByTestId(id);
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width, `${id} clipped by 1024px viewport`).toBeLessThanOrEqual(1026);
    expect(box!.x + box!.width, `${id} spills beyond decision panel`).toBeLessThanOrEqual(panel!.x + panel!.width + 2);
  }
  for (const control of [primary, page.getByTestId('action-fold'), page.getByTestId('action-raise')]) {
    expect(await control.evaluate(element => element.scrollWidth - element.clientWidth), 'bet action label clipped').toBeLessThanOrEqual(1);
  }
  await expect(page.getByTestId('action-fold')).toHaveText('フォールド');
  await expect(page.getByTestId('action-raise')).toContainText('レイズ');
});

test('guest Razz advances naturally to one clear Japanese result action', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(trialGameUrl('razz'), { waitUntil: 'domcontentloaded' });
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
