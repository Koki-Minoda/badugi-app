import { chromium, webkit } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const output = 'reports/release-v1/prototype-layout.json';
const screenshots = 'reports/screenshots/v1-design';
fs.mkdirSync(path.dirname(output),{recursive:true});fs.mkdirSync(screenshots,{recursive:true});
const rows=[];
for (const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]) {
  const browser=await launcher.launch();
  try {
    for(const [width,height] of [[390,844],[844,390],[320,568],[1280,900]]) {
      const page=await browser.newPage({viewport:{width,height}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:8793/play-comparison.html');
      for(const design of ['a','b','c']) for(const game of ['nlh','stud8','draw']) {
        await page.locator(`button[data-design=${design}]`).click();
        await page.locator('#game').selectOption(game);
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
        const overlap=await page.evaluate(()=>{const entries=[...document.querySelectorAll('.seat,.hero,.center')].map(el=>({name:el.className,r:el.getBoundingClientRect()}));return entries.flatMap((a,i)=>entries.slice(i+1).filter(b=>Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>2&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>2).map(b=>[a.name,b.name]));});
        if(overlap.length)throw new Error(`${engine} ${width} ${design} ${game}: overlapping information ${JSON.stringify(overlap)}`);
        if(overflow)throw new Error(`${engine} ${width} ${design} ${game}: horizontal overflow`);
        await page.locator('#history-open').click();
        if(!await page.locator('#history').isVisible())throw new Error('History must open in one tap');
        await page.locator('[data-close=history]').click();
        if(game==='nlh') {
          await page.locator('#custom-open').click();
          await page.locator('#amount-input').fill('9');await page.locator('#amount-confirm').click();
          if(!await page.locator('#amount').isVisible())throw new Error('Illegal raise accepted');
          await page.locator('#amount-input').fill('18');await page.locator('#amount-confirm').click();
          if(await page.locator('#amount').isVisible())throw new Error('Legal amount failed');
          if(!await page.locator('#feedback').textContent().then(t=>t.includes('16 BB')))throw new Error('Additional amount mismatch');
          await page.locator('#waiting').check();await page.locator('#reserve-check').check();
          await page.locator('#waiting').uncheck();
          if(await page.locator('#reserve-check').isChecked())throw new Error('Stale reservation retained');
        }
        if(game==='draw') {
          await page.locator('#hero-cards button').last().click();
          if(await page.locator('#call').textContent()!=='1枚交換')throw new Error('Draw selection mismatch');
        }
        rows.push({engine,width,height,design,game,status:'PASS',scope:'prototype layout and scripted interactions'});
        if(engine==='webkit'&&design==='b'&&game==='stud8')await page.locator('.device').screenshot({path:`${screenshots}/b-stud8-${width}x${height}.png`});
      }
      if(errors.length)throw new Error(errors.join('\n'));
      await page.close();
    }
  }finally{await browser.close();fs.writeFileSync(output,JSON.stringify({generatedAt:new Date().toISOString(),sourceHashes:Object.fromEntries(['html','css','js'].map(ext=>{const p=`docs/design/prototypes/play-comparison.${ext}`;return [p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]})),rows,releaseGatePassed:false},null,2)+'\n');}
}
process.stdout.write(`${rows.length} prototype combinations passed\n`);
