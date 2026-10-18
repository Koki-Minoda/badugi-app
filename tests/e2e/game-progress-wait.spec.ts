import { expect, test } from '@playwright/test';
import { getProgressState, progressKey, waitForProgressChange } from './helpers/gameProgressHelper.js';

async function installDrawSnapshot(page, actorFields = { currentActor: null, turn: null, nextTurn: null }) {
  await page.setContent('<div data-testid="table-phase-badge">DRAW | D1</div>');
  await page.evaluate((fields) => {
    const snapshot = {
      phase: 'DRAW', handId: 'draw-complete', drawRoundIndex: 1, pot: 60,
      players: [{ stack: 4990, hasDrawn: true }], ...fields,
    };
    window.__BADUGI_E2E__ = {
      getStateSnapshot: () => ({ gameVariant: 'deuce_to_seven_single_draw', turn: 5, controllerSnapshot: snapshot }),
      getPhaseState: () => ({ phase: 'DRAW', turn: 5 }),
    };
  }, actorFields);
}

test('completed draw does not treat a stale legacy actor as progress', async ({ page }) => {
  await installDrawSnapshot(page);
  const before = await getProgressState(page);
  expect(before.actor).toBeNull();
  await expect(waitForProgressChange(page, progressKey(before), { timeout: 200 })).rejects.toThrow(/Timeout/);
  expect(progressKey(await getProgressState(page))).toBe(progressKey(before));
});

test('completed draw waits for the actual next betting round', async ({ page }) => {
  await installDrawSnapshot(page);
  const before = await getProgressState(page);
  await page.evaluate(() => {
    setTimeout(() => {
      const snapshot = window.__BADUGI_E2E__.getStateSnapshot().controllerSnapshot;
      snapshot.phase = 'BET';
      snapshot.currentActor = 1;
      document.querySelector('[data-testid="table-phase-badge"]').textContent = 'BET | R2';
    }, 300);
  });
  await waitForProgressChange(page, progressKey(before), { timeout: 2000 });
  const after = await getProgressState(page);
  expect(after.phase).toBe('BET');
  expect(after.actor).toBe(1);
});

test('legacy actor remains a fallback only when the snapshot omits actor fields', async ({ page }) => {
  await installDrawSnapshot(page, {});
  const before = await getProgressState(page);
  expect(before.actor).toBe(5);
  await expect(waitForProgressChange(page, progressKey(before), { timeout: 200 })).rejects.toThrow(/Timeout/);
  await page.evaluate(() => {
    window.__BADUGI_E2E__.getPhaseState = () => ({ phase: 'DRAW', turn: 0 });
  });
  await waitForProgressChange(page, progressKey(before), { timeout: 2000 });
  expect((await getProgressState(page)).actor).toBe(0);
});
