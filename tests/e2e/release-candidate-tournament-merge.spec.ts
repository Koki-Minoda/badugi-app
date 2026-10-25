import {clickHeroAction} from './helpers/clickHeroAction';
import {expect,test} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {APP_URL,enterTitleIfPresent,selectGameVariantFromSelector} from './authHelper';
import {waitForE2EDriver} from './helpers/gameProgressHelper.js';

const variants = (process.env.MGX_CANDIDATE_MTT_VARIANTS ?? 'super_holdem,fl_super_holdem').split(',').filter(Boolean);
for (const tableCount of (process.env.MGX_CANDIDATE_MTT_TABLES ?? '3').split(',').map(Number)) {
const totalPlayers=tableCount*6,totalChips=totalPlayers*500;
for (const variant of variants) {
test(`${variant}: natural ${totalPlayers}-player tournament merge and elimination`,async({page},testInfo)=>{
 test.skip(process.env.MGX_CANDIDATE_MTT_QA !== '1', 'Explicit release-candidate tournament QA');
 test.setTimeout(600000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:9001,username:'QA Hero'})}));
 await page.addInitScript(()=>localStorage.setItem('mgx_auth',JSON.stringify({accessToken:'test',user:{id:9001,username:'QA Hero'},isAuthenticated:true})));
 await page.addInitScript(()=>localStorage.setItem('mgx.previewVariants','true'));
 await page.goto(APP_URL);await enterTitleIfPresent(page);await page.getByTestId('menu-ring').click();await selectGameVariantFromSelector(page,variant);await waitForE2EDriver(page);
 await page.evaluate(({variant,tableCount,totalPlayers})=>window.__BADUGI_E2E__.startTournamentMTT({id:`${variant}-merge-soak`,name:`${variant} merge QA`,practiceOnly:true,tables:tableCount,seatsPerTable:6,totalPlayers,startingStack:500,gameVariant:variant,gameRotation:[variant],levels:[5,10,25,50,100,250,500,1000].map((sb,i)=>({levelIndex:i+1,smallBlind:sb,bigBlind:sb*2,ante:0,handsThisLevel:10}))}),{variant,tableCount,totalPlayers});
 const rows=[];let last='',final=false;let terminal=false;let terminalKind=null;
 const end=Date.now()+540000;
 while(Date.now()<end){
  if(errors.length)break; // Preserve evidence immediately when the game throws.
  const s=await page.evaluate(()=>{const api=window.__BADUGI_E2E__;return {hand:api.getStateSnapshot().handId,terminal:!!document.querySelector('[data-testid=mtt-hero-bust-overlay],[data-testid=mtt-result-overlay]'),result:!!document.querySelector('[data-testid=hand-result-overlay]'),state:JSON.parse(localStorage.getItem('mgx.tournament.mtt.active'))?.tournamentState};});
  if(s.terminal){terminal=true;terminalKind=await page.getByTestId('mtt-hero-bust-overlay').isVisible()?'hero-bust':'champion';break;}
  if(s.result&&s.hand!==last){
   last=s.hand;const t=s.state,p=Object.values(t.players),tables=t.tables.filter(t=>t.isActive),ids=tables.flatMap(t=>t.seats.map(s=>s.playerId).filter(Boolean));
   expect(p.reduce((n,p)=>n+p.stack,0)).toBe(totalChips);expect(new Set(ids).size).toBe(t.playersRemaining);
   expect(new Set(p.map(player=>player.name)).size).toBe(totalPlayers);
   for(const player of p)if(player.busted){expect(player.stack).toBe(0);expect(player.finishPlace).toBeGreaterThan(0);expect(ids).not.toContain(player.id);}
   expect(tables.length).toBe(Math.ceil(t.playersRemaining/6));
   expect(tables.length).toBeLessThanOrEqual(rows.at(-1)?.tables??tableCount);
   expect(t.players['hero-player'].tableId).toBe('table-1');
   expect(t.levelIndex+t.tables.find(table=>table.tableId==='table-1').handsPlayedAtThisLevel,'completed hand must update tournament accounting').toBeGreaterThan(0);
   rows.push({hand:s.hand,tables:tables.length,remaining:t.playersRemaining,level:t.levelIndex+1,hero:t.players['hero-player'].stack});final||=tables.length===1;
   if(rows.length%10===0)console.log('[CANDIDATE_MTT]',JSON.stringify({variant,project:testInfo.project.name,...rows.at(-1)}));
   await page.getByTestId('hand-result-next-hand').click();continue;
  }
  if(!s.result){
   if(await page.getByTestId('bet-amount-sheet').isVisible()){
    const allIn=page.getByTestId('bet-preset-all-in');
    if(await allIn.isVisible())await allIn.click();
    await page.getByTestId('bet-amount-confirm').click();continue;
   }
   for(const id of final?['bet-amount-confirm','action-allin_call','action-raise','action-check','action-call','action-draw-selected']:['action-fold']){
    const button=page.locator(`[data-testid="${id}"]:not([disabled])`);
    if(await button.count()){
     try {await clickHeroAction(page,id,{timeout:1000});break;}
     catch(error){if(await button.count())throw error;} // Phase advanced while locating the old action.
    }
   }
  }
  await page.waitForTimeout(150);
 }
 const result={variant,initialTables:tableCount,totalPlayers,totalChips,project:testInfo.project.name,viewport:page.viewportSize(),apiStubbed:true,completionMethod:'natural-actions-until-terminal-overlay',postHeroBust:'production-auto-completion',terminalKind,blindStructure:'doubling-or-2.5x-every-10-hands',finalTablePolicy:'maximum-legal-bet',rows,terminal,errors,placements:await page.evaluate(()=>window.__BADUGI_E2E__.getTournamentPlacements())};
 await page.screenshot({path:testInfo.outputPath(`${variant}-terminal.png`)});
 await writeFile(testInfo.outputPath(`${variant}-merge.json`),JSON.stringify(result,null,2));
 expect(terminal).toBe(true);expect(rows[0]?.tables).toBe(tableCount);expect(final).toBe(true);
 expect(result.placements).toHaveLength(totalPlayers);expect(new Set(result.placements.map(p=>p.place)).size).toBe(totalPlayers);
 expect(new Set(result.placements.map(p=>p.name)).size).toBe(totalPlayers);
 const placementNames=new Set(result.placements.map(p=>p.name));
 const historyNames=await page.evaluate(()=>window.__BADUGI_E2E__.getHandHistory().map(hand=>(hand.seats??[]).map(seat=>seat.name)));
 expect(historyNames.length).toBeGreaterThan(0);
 for(const seats of historyNames){
  const participantNames=seats.filter(name=>placementNames.has(name));
  expect(new Set(participantNames).size).toBe(participantNames.length);
  expect(seats.filter(name=>name&&!placementNames.has(name)&&!name.startsWith('(Empty Seat'))).toEqual([]);
 }
 expect(result.placements.reduce((n,p)=>n+p.stack,0)).toBe(totalChips);expect(errors).toEqual([]);
 await expect(page.getByTestId('hand-result-overlay')).toHaveCount(0);
 await page.locator('[data-testid=mtt-hero-bust-overlay],[data-testid=mtt-result-overlay]').getByTestId('mtt-back-to-menu').click();await expect(page.getByTestId('menu-ring')).toBeVisible();
});

}

}
