// Run against Chrome inside the disposable Pixel 9 AVD, not desktop emulation.
// adb -s emulator-5554 reverse tcp:4178 tcp:4178
// adb -s emulator-5554 forward tcp:9223 localabstract:chrome_devtools_remote
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:4178';
const output = new URL('./simulator-artifacts/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const page = await browser.contexts()[0].newPage();
page.setDefaultTimeout(15000);
const errors = [];
const passed = [];
page.on('pageerror', error => errors.push(error.message));
const shot = name => page.screenshot({ path: new URL(`${name}.png`, output).pathname, fullPage: false });
async function finish() {
  for (let i = 0; i < 70; i++) {
    const result = page.getByTestId('practice-result');
    const action = page.getByRole('button', { name: /^(チェック|コール \d+|0枚交換する)$/ }).first();
    await expect(result.or(action)).toBeVisible();
    if (await result.isVisible()) return;
    if ((await action.textContent()).includes('枚交換')) {
      await page.getByTestId('practice-hero-hand').getByRole('button').first().click();
      await page.getByRole('button', { name: '1枚交換する', exact: true }).click();
    } else await action.click();
  }
  throw new Error('Hand did not finish');
}
try {
  await page.goto(`${base}/learn`);
  const environment = await page.evaluate(() => ({ userAgent: navigator.userAgent, width: innerWidth, height: innerHeight }));
  expect(environment.userAgent).toContain('Android');
  // Only this local QA origin is reset; no production data is accessed.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.addInitScript(() => { Math.random = () => 0.999; });
  await page.reload();
  await page.getByRole('link', { name: '種目切り替えのルールを6問' }).click();
  await page.getByRole('button', { name: '1回', exact: true }).click();
  await page.getByRole('link', { name: '学習に戻る', exact: true }).click();
  await page.reload();
  await page.getByRole('link', { name: /間違えたクイズを復習（1問）/ }).click();
  await page.getByRole('button', { name: '3回', exact: true }).click();
  await page.getByRole('button', { name: '結果を見る' }).click();
  await page.getByRole('link', { name: '学習に戻る', exact: true }).click();
  await expect(page.getByTestId('learning-totals')).toContainText('50%');
  await expect(page.getByRole('link', { name: /間違えたクイズを復習/ })).toHaveCount(0);
  passed.push('quiz wrong answer, reload, retry, totals');
  for (const [index, variant] of ['badugi', 'ace_to_five_triple_draw', 'deuce_to_seven_triple_draw'].entries()) {
    await page.goto(`${base}/learn/practice`);
    await page.getByLabel('種目', { exact: true }).selectOption(variant);
    const selected = await page.getByLabel('選んだ手札').textContent();
    await page.getByLabel('練習条件の名前').fill(`Android ${variant}`);
    expect(await page.getByLabel('練習条件の名前').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await page.getByRole('button', { name: '現在の条件を保存' }).click();
    await page.reload();
    await page.getByLabel('保存した練習条件').selectOption({ label: `Android ${variant}` });
    await page.getByRole('button', { name: 'この条件を呼び出す' }).click();
    await expect(page.getByLabel('種目', { exact: true })).toHaveValue(variant);
    await expect(page.getByLabel('選んだ手札')).toHaveText(selected);
    await page.getByRole('button', { name: 'この手札で練習する' }).click();
    await finish();
    await shot(`android-${variant}-finished`);
    await page.getByRole('button', { name: 'あとで復習に保存' }).click();
    const record = await page.evaluate(() => JSON.parse(localStorage.getItem('mgx.handReviews.v1')).entries[0].hand);
    expect(record.seats.map(s => s.name)).toEqual(['You', 'CPU 1', 'CPU 2', 'CPU 3', 'CPU 4', 'CPU 5']);
    for (const winner of record.events.find(e => e.type === 'HAND_END').winners) expect(winner.name).toBe(record.seats[winner.seat].name);
    await page.getByRole('button', { name: '同じ開始手札でもう一度' }).click();
    await expect(page.getByTestId('practice-result')).toHaveCount(0);
    await page.getByRole('button', { name: '条件を変更' }).click();
    await expect(page.getByLabel('選んだ手札')).toHaveText(selected);
    await page.getByRole('link', { name: '学習に戻る', exact: true }).click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect(page.getByTestId('learning-totals')).toContainText(`練習完了 ${index + 1}`);
    passed.push(`${variant}: preset save/reload/load, full hand, save, repeat, progress`);
  }
  await page.goto(`${base}/learn/review`);
  await page.getByTestId('saved-hand').first().locator('summary').click();
  await page.getByRole('button', { name: '復習済みにする', exact: true }).click();
  await page.getByTestId('saved-hand').first().getByLabel(/^メモ/).fill('Android simulator review');
  await page.getByTestId('saved-hand').first().getByLabel('タグ（カンマ区切り）').fill('交換');
  await page.getByRole('button', { name: 'メモとタグを保存' }).click();
  await page.reload();
  await page.getByTestId('saved-hand').first().locator('summary').click();
  await expect(page.getByTestId('saved-hand').first().getByLabel(/^メモ/)).toHaveValue('Android simulator review');
  await expect(page.getByRole('button', { name: '復習済み・未復習に戻す' })).toBeVisible();
  await page.getByRole('link', { name: 'この開始手札で練習', exact: true }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.getByLabel('種目', { exact: true })).toHaveValue('deuce_to_seven_triple_draw');
  passed.push('review status, notes, tags, reload, transfer starting hand');
  await page.getByRole('link', { name: '学習に戻る', exact: true }).click();
  await page.getByLabel('Language').selectOption('en');
  await expect(page.getByRole('heading', { name: 'What to study today' })).toBeVisible();
  await shot('android-final-progress');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
  passed.push('English dashboard, width, no page errors');
  await writeFile(new URL('android-results.json', output), JSON.stringify({ environment, passed, errors }, null, 2));
  console.log(JSON.stringify({ environment, passed, errors }, null, 2));
} catch (error) {
  await shot('android-failure');
  console.error({ passed, errors });
  throw error;
} finally { await browser.close(); }
