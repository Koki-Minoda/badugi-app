import { expect, test } from '@playwright/test';
import { LANGUAGE_STORAGE_KEY } from '../../src/config/mgxLocaleConfig.js';
import { APP_URL, openAuthenticatedGame, deleteAuthenticatedSession } from './authHelper';
import { playOneHandProgression, waitForE2EDriver } from './helpers/gameProgressHelper.js';

for (const language of ['ja', 'en']) for (const viewport of [{width:390,height:844},{width:852,height:320},{width:1440,height:900}]) for (const variant of ['nlh','badugi','archie_triple_draw']) {
  test(`${variant} ${language} result labels and controls at ${viewport.width}x${viewport.height}`, async ({page}, info) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(({key, language}) => {
      localStorage.setItem(key, language);
      localStorage.setItem('mgx.previewVariants', 'true');
    }, {key:LANGUAGE_STORAGE_KEY,language});
    const session = await openAuthenticatedGame(page, `${APP_URL}?variant=${variant}`);
    try {
      await waitForE2EDriver(page);
      const result = await playOneHandProgression(page, {maxSteps:220,policy:'heroStay',requireHeroButtonClick:true,requireDrawVisit:variant!=='nlh',drawCardIndexes:[0]});
      expect(result.status).toBe('PASS');
      const dialog = page.getByRole('dialog',{name:language==='ja'?'ハンドの結果':'Hand Result'});
      await expect(dialog).toBeVisible();
      await expect(page.getByTestId('hand-result-total')).toContainText(language==='ja'?'チップ':'chips');
      await expect(dialog).not.toContainText('¥');
      await expect(page.getByTestId('hand-result-next-hand')).toHaveText(language==='ja'?'次のハンドへ':'Next hand');
      for (const id of ['hand-result-next-hand','hand-result-history','hand-result-cash-out']) {
        const button=page.getByTestId(id);
        const metrics=await button.evaluate(element=>{const r=element.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {height:r.height,bottom:r.bottom,top:r.top,right:r.right,left:r.left,reachable:hit===element||element.contains(hit)};});
        expect(metrics.height).toBeGreaterThanOrEqual(44);
        expect(metrics.top).toBeGreaterThanOrEqual(0);
        expect(metrics.bottom).toBeLessThanOrEqual(viewport.height);
        expect(metrics.left).toBeGreaterThanOrEqual(0);
        expect(metrics.right).toBeLessThanOrEqual(viewport.width);
        expect(metrics.reachable).toBe(true);
      }
      await page.screenshot({path:info.outputPath('localized-result.png')});
      await page.getByTestId('hand-result-next-hand').click();
      await expect(dialog).toBeHidden();
    } finally { await deleteAuthenticatedSession(page, session); }
  });
}
