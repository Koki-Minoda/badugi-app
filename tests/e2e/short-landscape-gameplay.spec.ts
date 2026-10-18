import {test,expect} from '@playwright/test';
import {APP_URL,openAuthenticatedGame,deleteAuthenticatedSession} from './authHelper';
import {playOneHandProgression} from './helpers/gameProgressHelper.js';
const variants=['nlh','flh','super_holdem','fl_super_holdem','plo','plo8','flo8','big_o','five_card_plo','dramaha_hi','dramaha_27','dramaha_a5','dramaha_zero','dramaha_hidugi','dramaha_badugi'];
for(const variant of variants)test(`${variant}: short landscape keeps cards and bet controls visible`,async({page})=>{
 await page.setViewportSize({width:852,height:283});
 await page.addInitScript(()=>localStorage.setItem('mgx.previewVariants','true'));
 const session=await openAuthenticatedGame(page,`${APP_URL}?variant=${variant}`);
 try{
  await expect(page.getByTestId('player-action-hint')).toBeVisible();
  await expect.poll(()=>page.getByTestId('seat-0').evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(283);
  if(await page.getByTestId('bet-size-input').isVisible()){
   for(const e of await page.locator('[data-testid^=bet-preset-],[data-testid=bet-size-input]').all()){
    const b=await e.boundingBox();expect(b!.height).toBeGreaterThanOrEqual(44);
    expect(await e.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
   }
  }
  expect((await playOneHandProgression(page,{maxSteps:180,policy:'heroStay',requireHeroButtonClick:true})).status).toBe('PASS');
 }finally{await deleteAuthenticatedSession(page,session);}
});
