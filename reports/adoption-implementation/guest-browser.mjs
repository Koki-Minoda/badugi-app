import assert from 'node:assert/strict';
import { webkit } from 'playwright';
import { PUBLIC_PLAYABLE_VARIANTS } from '../../src/games/config/variantAvailability.js';
import { mkdir,writeFile } from 'node:fs/promises';
const browser=await webkit.launch({headless:true});const rows=[];const output=new URL('./artifacts/',import.meta.url);await mkdir(output,{recursive:true});
async function run(v,index){const context=await browser.newContext({viewport:index%2?{width:844,height:390}:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','OPTIONS'].includes(r.method()))writes.push({path:new URL(r.url()).pathname,method:r.method()});});let actions=0;try{await page.goto(`http://127.0.0.1:4179/game?trial=1&variant=${v.availabilityKey}`);const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>/history|rating|progress|heroTracker|bankroll|ofc.session/i.test(key))));let done=false;
for(let i=0;i<400;i++){
 if(v.id==='chinese_poker'){const submit=page.getByTestId('chinese-submit');if(await submit.count()&&await submit.isVisible()){await page.getByRole('button',{name:/^自動配置$|^Auto Arrange$/}).click();await submit.click();actions+=2;}}

 const result=page.locator('[data-testid="hand-result-overlay"], [data-testid="ofc-result"], [data-testid="chinese-result-summary"]');
 if(await result.count()&&await result.first().isVisible()){done=true;break;}
 const next=page.getByRole('button',{name:/体験を終了・種目を選ぶ|Finish trial \/ choose a game/});if(await next.count()&&await next.first().isVisible()){done=true;break;}
 let clicked=false;for(const id of ['ofc-suggest','ofc-confirm','chinese-auto-arrange','chinese-confirm','action-call','action-check','action-draw-selected','action-stand-pat','action-bring-in','action-complete']){const b=page.getByTestId(id).first();if(await b.count()&&await b.isVisible()&&await b.isEnabled()){await b.click({timeout:3000});actions++;clicked=true;if(id==='ofc-suggest'){const c=page.getByTestId('ofc-confirm');if(await c.isEnabled()) {await c.click();actions++;}}break;}}
 if(!clicked){const pat=page.getByRole('button',{name:/^交換なし|^Stand pat|^ブリングイン|^Bring.in/}).first();if(await pat.count()&&await pat.isVisible()&&await pat.isEnabled()){await pat.click();actions++;}}
 await page.waitForTimeout(150);
}
const after=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>/history|rating|progress|heroTracker|bankroll|ofc.session/i.test(key))));
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);await page.screenshot({path:new URL(`guest-${v.id}-${index%2?'landscape':'portrait'}.png`,output).pathname});
const row={id:v.id,variant:v.availabilityKey,done,actions,overflow,errors,writes,statsUnchanged:JSON.stringify(before)===JSON.stringify(after)};if(!done)row.visibleText=(await page.locator('body').innerText()).slice(-2300);rows.push(row);console.log(JSON.stringify(row));
}catch(e){rows.push({id:v.id,error:e.message});console.log(JSON.stringify(rows.at(-1)));}finally{await context.close();}}
const variants=process.env.MGX_GUEST_VARIANTS ? PUBLIC_PLAYABLE_VARIANTS.filter(v=>process.env.MGX_GUEST_VARIANTS.split(',').includes(v.id)) : PUBLIC_PLAYABLE_VARIANTS;
let index=0;try{await Promise.all(Array.from({length:3},async()=>{while(index<variants.length){const i=index++;await run(variants[i],i);}}));}finally{await writeFile(new URL(process.env.MGX_GUEST_VARIANTS ? './guest-dedicated.json' : './guest-browser.json',import.meta.url),JSON.stringify(rows,null,2)+'\n');await browser.close();}
assert(rows.every(r=>r.done&&!r.overflow&&!r.errors.length&&!r.writes.length&&r.statsUnchanged),'guest QA failures; see report');
