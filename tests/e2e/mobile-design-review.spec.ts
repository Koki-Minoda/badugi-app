import {measureMobileLayout} from '../../reports/gameplay-device/mobile-layout-check.mjs';
import {test,expect} from '@playwright/test';
import {listVariantProfiles} from '../../src/games/config/variantProfiles.js';
const variants=listVariantProfiles().map(v=>v.engineKey).filter(v=>!['ofc','chinese_poker'].includes(v));
import {APP_URL,openAuthenticatedGame,deleteAuthenticatedSession} from './authHelper';
import {playOneHandProgression} from './helpers/gameProgressHelper.js';
const sizes=[{width:852,height:283},{width:393,height:695}];
for(const variant of variants)for(const viewport of [...sizes,...(['nlh','stud','badugi','dramaha_hi','big_o'].includes(variant)?[{width:320,height:568},{width:667,height:265}]:[]),...(['nlh','stud'].includes(variant)?[{width:393,height:650},{width:393,height:680}]:[])])test(`${variant} ${viewport.width}x${viewport.height}: readable stable table`,async({page},info)=>{
 await page.setViewportSize(viewport);await page.addInitScript(()=>localStorage.setItem('mgx.previewVariants','true'));
 const session=await openAuthenticatedGame(page,`${APP_URL}?variant=${variant}`);
 try{
  await expect(page.getByTestId('mobile-play-layout')).toBeVisible();
  await expect(page.getByTestId('player-action-hint')).toBeVisible();
  await page.screenshot({path:info.outputPath('playing.png')});
  const geometry=await page.evaluate(()=>{
   const boxes=[...document.querySelectorAll('[data-testid]')].filter(e=>/^seat-\d+$/.test(e.getAttribute('data-testid')||'')).map(e=>{const r=e.getBoundingClientRect();return {id:e.getAttribute('data-testid'),x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
   const overlaps=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)overlaps.push([a.id,b.id]);}
   return {boxes,overlaps,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(geometry.overlaps).toEqual([]);expect(geometry.overflow).toBeLessThanOrEqual(1);
  for(const box of geometry.boxes){expect(box.y).toBeGreaterThanOrEqual(0);expect(box.bottom).toBeLessThanOrEqual(viewport.height);}
  let capturedSeven=false;
  const result=await playOneHandProgression(page,{maxSteps:180,policy:'heroStay',requireHeroButtonClick:true,onStep:async({progress})=>{
   if(progress.isTerminal)return;
   expect((await page.evaluate(measureMobileLayout)).issues).toEqual([]);
   if(variant==='stud'&&!capturedSeven&&await page.locator('.is-hero .mgx-table-card').count()===7){await page.screenshot({path:info.outputPath('seven-cards.png')});capturedSeven=true;}
   const clipped=await page.evaluate(()=>[...document.querySelectorAll('.mgx-table-seat [data-testid]')].filter(e=>/^player-\d+-card-\d+$/.test(e.getAttribute('data-testid')||'')).filter(e=>{const r=e.getBoundingClientRect(),p=e.closest('.mgx-table-seat').getBoundingClientRect();return r.x<p.x-1||r.right>p.right+1||r.y<p.y-1||r.bottom>p.bottom+1;}).map(e=>e.getAttribute('data-testid')));
   expect(clipped).toEqual([]);
  }});expect(result.status).toBe('PASS');
  await page.screenshot({path:info.outputPath('result.png')});
 }finally{await deleteAuthenticatedSession(page,session);}
});
for(const viewport of [...sizes,{width:320,height:568},{width:667,height:265}])test(`touch keypad ${viewport.width}x${viewport.height} replaces amount, cancels safely, and submits only on confirmation`,async({page},info)=>{
 await page.setViewportSize(viewport);const session=await openAuthenticatedGame(page,`${APP_URL}?variant=nlh`);
 try{
  await expect(page.getByTestId('bet-size-input')).toBeEnabled();await page.getByTestId('bet-size-input').tap();
  await expect(page.getByRole('dialog',{name:'金額を指定'})).toBeVisible();
  for(const key of ['8','0'])await page.getByTestId(`bet-key-${key}`).tap();
  await expect(page.getByTestId('bet-amount-value')).toHaveText('80');
  await page.screenshot({path:info.outputPath('keypad-80.png')});
  for(const button of await page.getByTestId('bet-amount-sheet').getByRole('button').all()){
   const box=await button.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height);expect(box!.height).toBeGreaterThanOrEqual(44);
   expect(await button.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
  }
  await page.getByTestId('bet-amount-cancel').tap();await expect(page.getByTestId('action-call')).toBeEnabled();
  await page.getByTestId('bet-size-input').tap();await page.getByTestId('bet-key-8').tap();await page.getByTestId('bet-key-0').tap();await page.getByTestId('bet-amount-confirm').tap();
  await expect(page.getByTestId('bet-amount-sheet')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=> (window as any).__BADUGI_E2E__?.getStateSnapshot()?.players?.[0]?.bet)).toBe(80);
 }finally{await deleteAuthenticatedSession(page,session);}
});
