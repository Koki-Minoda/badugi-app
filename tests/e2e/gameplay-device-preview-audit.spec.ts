import { test, expect } from '@playwright/test';
import { VARIANT_AVAILABILITY } from '../../src/games/config/variantAvailability.js';
import { APP_URL, openAuthenticatedGame, deleteAuthenticatedSession } from './authHelper';
import { playOneHandProgression, waitForE2EDriver } from './helpers/gameProgressHelper.js';
import { cashOutToSelector } from './helpers/core5LifecycleE2EHelper';
import { validateReplayReadyHandHistory } from '../../src/ui/utils/handHistoryReplayRequirements.js';

for (const [id, variant] of Object.entries(VARIANT_AVAILABILITY)) {
  if (variant.availability !== 'preview_only') continue;
  test(`${id}: preview hand, history, exit`, async ({ page }, info) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('mgx.previewVariants', 'true'));
    const session = await openAuthenticatedGame(page, `${APP_URL}?variant=${id}&mode=cash`);
    try {
      await waitForE2EDriver(page);
      const result = await playOneHandProgression(page, {
        maxSteps: 220, policy: 'heroStay', requireHeroButtonClick: true,
        requireDrawVisit: id.includes('draw'), drawCardIndexes: [0],
      });
      expect(result.status).toBe('PASS');
      const records = await page.evaluate(() => JSON.parse(localStorage.getItem('badugi.history.hands') || '[]'));
      expect(records.length).toBeGreaterThan(0);
      const record = records.at(-1);
      const replay = validateReplayReadyHandHistory(record, { variantId: record.variantId });
      expect(replay.valid, replay.missing.join(', ')).toBe(true);
      await page.screenshot({ path: info.outputPath('preview-result.png') });
      await cashOutToSelector(page);
      expect(errors).toEqual([]);
      await info.attach('preview-result', { body: JSON.stringify({ id, handId: record.handId, heroButtonClicks: result.heroButtonClicks, phases: result.visitedPhases, replay, errors }), contentType: 'application/json' });
    } finally { await deleteAuthenticatedSession(page, session); }
  });
}
