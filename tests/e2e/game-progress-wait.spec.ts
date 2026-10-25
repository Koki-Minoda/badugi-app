import {clickHeroAction} from './helpers/clickHeroAction';
import { visibleHeroActions } from "./helpers/visibleHeroActions";
import { expect, test } from '@playwright/test';
import { getProgressState, progressKey, waitForProgressChange, playOneHandProgression } from './helpers/gameProgressHelper.js';

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

test('hand completion between the progress read and action selection is terminal, not a freeze', async ({ page }) => {
  await installDrawSnapshot(page, { currentActor: 0, turn: 0, nextTurn: 0 });
  const result = await playOneHandProgression(page, {
    maxSteps: 3,
    onStep: async ({ step }) => {
      if (step !== 0) return;
      await page.evaluate(() => {
        const snapshot = window.__BADUGI_E2E__.getStateSnapshot().controllerSnapshot;
        snapshot.phase = 'HAND_RESULT';
        snapshot.currentActor = snapshot.turn = snapshot.nextTurn = null;
        document.querySelector('[data-testid="table-phase-badge"]').textContent = 'HAND_RESULT';
      });
    },
  });
  expect(result.status).toBe('PASS');
  expect(result.visitedPhases).toContain('HAND_RESULT');
});

test('tournament table finished after hero bust ends hand progression', async ({ page }) => {
  await installDrawSnapshot(page, { currentActor: null, turn: null, nextTurn: null });
  await page.evaluate(() => {
    const snapshot = window.__BADUGI_E2E__.getStateSnapshot().controllerSnapshot;
    snapshot.phase = 'TABLE_FINISHED';
    snapshot.players[0] = { stack: 0, seatOut: true, folded: true, allIn: true };
    // The badge may lag behind the terminal controller snapshot during bust settlement.
    document.querySelector('[data-testid="table-phase-badge"]').textContent = 'BET | R1';
  });
  const progress = await getProgressState(page);
  expect(progress.isTerminal).toBe(true);
  expect((await playOneHandProgression(page, { maxSteps: 2 })).status).toBe('PASS');
});


test('action snapshot does not wait for a button removed during a phase change', async ({ page }) => {
  page.setDefaultTimeout(700);
  await page.setContent('<button data-testid="action-call">Call</button>');
  // Reproduce the phase transition between separate visibility/enabled reads.
  const transitioningPage = new Proxy(page, {
    get(target, key) {
      if (key === 'getByTestId') return (id) => {
        const button = target.getByTestId(id).first();
        return { first: () => ({
          count: () => button.count(),
          isVisible: async () => {
            const visible = await button.isVisible();
            if (visible) await button.evaluate((element) => element.remove());
            return visible;
          },
          isEnabled: () => button.isEnabled(),
        }) };
      };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const startedAt = Date.now();
  await visibleHeroActions(transitioningPage);
  expect(Date.now() - startedAt).toBeLessThan(500);
  await page.setContent('<button data-testid="action-fold" disabled>Fold</button><button data-testid="action-check" hidden>Check</button><button data-testid="action-draw-selected">Draw</button>');
  expect(await visibleHeroActions(page)).toEqual(['action-draw-selected']);
  await page.setContent('');
  expect(await visibleHeroActions(page)).toEqual([]);
});

for (const phase of ['HAND_RESULT', 'BET']) {
  test(`cash click only accepts a settled result overlay (${phase})`, async ({page}) => {
    await page.setContent('<button data-testid="action-call">Call</button><div data-testid="hand-result-overlay" style="position:fixed;inset:0;z-index:10">Result</div>');
    await page.evaluate(phase => {
      window.__BADUGI_E2E__ = {getStateSnapshot: () => ({phase, handId:'settlement-race'})};
    }, phase);
    if (phase === 'HAND_RESULT') expect(await clickHeroAction(page, 'action-call', {timeout:200})).toBe(false);
    else await expect(clickHeroAction(page, 'action-call', {timeout:200})).rejects.toThrow(/Timeout/);
  });
}
test('cash action clicks remain real clicks', async ({page}) => {
  await page.setContent(`<button data-testid="action-call" onclick="this.textContent='Called'">Call</button>`);
  expect(await clickHeroAction(page, 'action-call')).toBe(true);
  await expect(page.getByTestId('action-call')).toHaveText('Called');
});

test('shared action selection survives a phase-change locator race', async ({page}) => {
  page.setDefaultTimeout(700);
  await installDrawSnapshot(page, {currentActor:0,turn:0,nextTurn:0});
  await page.evaluate(() => {
    const snapshot = window.__BADUGI_E2E__.getStateSnapshot().controllerSnapshot;
    snapshot.phase='BET'; snapshot.currentBet=0; snapshot.players[0].hasDrawn=false;
    document.querySelector('[data-testid="table-phase-badge"]').textContent='BET';
  });
  await page.evaluate(() => {
    const button=document.createElement('button');button.dataset.testid='action-check';button.textContent='Check';
    button.onclick=()=>{
      const snapshot=window.__BADUGI_E2E__.getStateSnapshot().controllerSnapshot;
      snapshot.phase='HAND_RESULT';snapshot.currentActor=null;
      document.querySelector('[data-testid="table-phase-badge"]').textContent='HAND_RESULT';
    };
    document.body.append(button);
  });
  const transitioningPage = new Proxy(page, {
    get(target,key){
      if(key==='getByTestId')return id=>{
        const button=target.getByTestId(id).first();
        return {first:()=>({
          count:()=>button.count(),
          isVisible:async()=>{const visible=await button.isVisible();if(visible)await button.evaluate(element=>element.remove());return visible;},
          isEnabled:()=>button.isEnabled(),
          click:options=>button.click(options),
        })};
      };
      const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
    },
  });
  const {performSafeAction}=await import('./helpers/gameProgressHelper.js');
  const result=await performSafeAction(transitioningPage);
  expect(result.acted).toBe(true);
  expect(result.clickedAction).toBe('action-check');
});
