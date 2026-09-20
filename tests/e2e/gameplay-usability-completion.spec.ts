import {test,expect} from '@playwright/test';
import {APP_URL,openAuthenticatedGame,deleteAuthenticatedSession} from './authHelper';
import {playOneHandProgression} from './helpers/gameProgressHelper.js';
for(const variant of ['badugi','stud','nlh','plo','dramaha_hi'])test(`${variant}: readable actions and persistent result controls`,async({page},info)=>{
 page.setDefaultTimeout(15000);
 const session=await openAuthenticatedGame(page,`${APP_URL}?variant=${variant}`);
 try{
  await expect(page.getByTestId('player-action-hint')).toBeVisible();
  await page.mouse.move(0,0);await page.waitForTimeout(350);await page.screenshot({path:info.outputPath('playing.png')});
  const input=page.getByTestId('bet-size-input');
  if(await input.isVisible()){
   if(await input.evaluate(el=>el.tagName==='INPUT'))expect(await input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
   else expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const result=await playOneHandProgression(page,{maxSteps:200,policy:'heroStay',requireHeroButtonClick:true,requireDrawVisit:variant==='badugi'||variant.startsWith('dramaha')});
  expect(result.status).toBe('PASS');
  await expect(page.getByTestId('hand-result-overlay')).toBeVisible();
  const winner=await page.getByTestId('hand-result-winner-summary').boundingBox();expect(winner).toBeTruthy();expect(winner!.y+winner!.height).toBeLessThan(page.viewportSize()!.height);
  for(const id of ['hand-result-next-hand','hand-result-cash-out']){
   const b=page.getByTestId(id);await expect(b).toBeVisible();const box=await b.boundingBox();
   expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.y).toBeGreaterThanOrEqual(0);
   expect(box!.y+box!.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);
   expect(await b.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({path:info.outputPath('result.png')});
 }finally{await deleteAuthenticatedSession(page,session);}
});
