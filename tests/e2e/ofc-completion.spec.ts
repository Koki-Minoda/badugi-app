import {test,expect} from '@playwright/test';
import {APP_URL,openAuthenticatedGame,deleteAuthenticatedSession,selectGameVariantFromSelector} from './authHelper';
import {replayOfcHistory} from '../../src/games/chinese/OpenFaceChineseController.js';
test('OFC: ten hands, immutable streets, reload, scores and exact replay',async({page},info)=>{
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const session=await openAuthenticatedGame(page,`${APP_URL}?variant=ofc`);
  try {
    await expect(page.getByTestId('ofc-screen')).toBeVisible();
    for(let hand=1;hand<=10;hand++){
      for(let step=0;step<9;step++){
        if(await page.getByTestId('ofc-result').isVisible())break;
        if(hand===1&&step===0){
          expect(await page.locator('[data-testid^=ofc-pending-]').count()).toBe(5);
          await page.getByTestId('ofc-place-front').click();
          await expect(page.getByTestId('ofc-confirm')).toBeDisabled();
          await page.getByRole('button',{name:'配置をやり直す'}).click();
        }
        await page.getByTestId('ofc-suggest').click();
        await expect(page.getByTestId('ofc-confirm')).toBeEnabled();
        await page.getByTestId('ofc-confirm').click();
        if(hand===1&&step===1){
          const saved=await page.evaluate(()=>localStorage.getItem('mgx.ofc.session.v1'));
          await page.reload();
          await page.getByTestId('title-enter-button').click();await page.getByTestId('menu-ring').click();
          await selectGameVariantFromSelector(page,'ofc');
          expect(await page.evaluate(()=>localStorage.getItem('mgx.ofc.session.v1'))).toBe(saved);
        }
      }
      await expect(page.getByTestId('ofc-result')).toBeVisible();
      await expect(page.getByTestId('ofc-replay-integrity')).toContainText('再現を確認済み');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
      const next=page.getByTestId('ofc-next');const b=await next.boundingBox();const viewport=page.viewportSize()!;
      expect(b!.y+b!.height).toBeLessThanOrEqual(viewport.height+1);
      const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.ofc.history.v1')!));
      expect(records.length).toBe(hand);expect(records[0].result.points.reduce((a:number,b:number)=>a+b,0)).toBe(0);
      expect(replayOfcHistory(records[0]).valid).toBe(true);
      if(hand===1)await page.screenshot({path:info.outputPath('ofc-result.png'),fullPage:true});
      if(hand<10)await next.click();
    }
    await page.locator('summary').filter({hasText:'履歴・配置リプレイ'}).click();
    await page.getByRole('button',{name:/#10 ·/}).click();
    await expect(page.getByTestId('ofc-replay')).toContainText('検証済み');
    expect(errors).toEqual([]);
  } finally {await deleteAuthenticatedSession(page,session);}
});
