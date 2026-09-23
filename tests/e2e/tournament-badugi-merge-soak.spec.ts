import {expect,test} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {APP_URL,enterTitleIfPresent,selectGameVariantFromSelector} from './authHelper';
import {waitForE2EDriver} from './helpers/gameProgressHelper.js';

test('Badugi plays an 18-player tournament through three tables, final table and elimination',async({page})=>{
 test.setTimeout(600000);await page.setViewportSize({width:852,height:283});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:9001,username:'QA Hero'})}));
 await page.addInitScript(()=>localStorage.setItem('mgx_auth',JSON.stringify({accessToken:'test',user:{id:9001,username:'QA Hero'},isAuthenticated:true})));
 await page.goto(APP_URL);await enterTitleIfPresent(page);await page.getByTestId('menu-ring').click();await selectGameVariantFromSelector(page,'badugi');await waitForE2EDriver(page);
 await page.evaluate(()=>window.__BADUGI_E2E__.startTournamentMTT({id:'badugi-merge-soak',name:'Badugi merge QA',practiceOnly:true,tables:3,seatsPerTable:6,totalPlayers:18,startingStack:500,gameVariant:'badugi',gameRotation:['badugi'],levels:[{levelIndex:1,smallBlind:5,bigBlind:10,ante:0,handsThisLevel:999}]}));
 const rows=[];let last='',final=false;let terminal=false;
 const end=Date.now()+540000;
 while(Date.now()<end){
  const s=await page.evaluate(()=>{const api=window.__BADUGI_E2E__;return {hand:api.getStateSnapshot().handId,terminal:!!document.querySelector('[data-testid=mtt-hero-bust-overlay],[data-testid=mtt-result-overlay]'),result:!!document.querySelector('[data-testid=hand-result-overlay]'),state:JSON.parse(localStorage.getItem('mgx.tournament.mtt.active'))?.tournamentState};});
  if(s.terminal){terminal=true;break;}
  if(s.result&&s.hand!==last){
   last=s.hand;const t=s.state,p=Object.values(t.players),tables=t.tables.filter(t=>t.isActive),ids=tables.flatMap(t=>t.seats.map(s=>s.playerId).filter(Boolean));
   expect(p.reduce((n,p)=>n+p.stack,0)).toBe(9000);expect(new Set(ids).size).toBe(t.playersRemaining);
   for(const player of p)if(player.busted){expect(player.stack).toBe(0);expect(player.finishPlace).toBeGreaterThan(0);expect(ids).not.toContain(player.id);}
   expect(t.players['hero-player'].tableId).toBe('table-1');
   rows.push({hand:s.hand,tables:tables.length,remaining:t.playersRemaining,hero:t.players['hero-player'].stack});final||=tables.length===1;
   await page.getByTestId('hand-result-next-hand').click();continue;
  }
  if(!s.result){
   for(const id of final?['action-raise','action-check','action-call','action-draw-selected']:['action-fold']){
    const button=page.getByTestId(id);if(await button.count()&&await button.isEnabled()){await button.click();break;}
   }
  }
  await page.waitForTimeout(150);
 }
 const result={rows,terminal,errors,placements:await page.evaluate(()=>window.__BADUGI_E2E__.getTournamentPlacements())};
 await writeFile('reports/adoption-implementation/portraits-tournament-2026-09-23/browser-badugi-merge.json',JSON.stringify(result,null,2));
 expect(terminal).toBe(true);expect(rows.some(r=>r.tables===2)).toBe(true);expect(final).toBe(true);
 expect(result.placements).toHaveLength(18);expect(new Set(result.placements.map(p=>p.place)).size).toBe(18);
 expect(result.placements.reduce((n,p)=>n+p.stack,0)).toBe(9000);expect(errors).toEqual([]);
 await expect(page.getByTestId('hand-result-overlay')).toHaveCount(0);
 await page.locator('[data-testid=mtt-hero-bust-overlay],[data-testid=mtt-result-overlay]').getByRole('button',{name:/back to menu/i}).click();await expect(page.getByTestId('menu-ring')).toBeVisible();
});
