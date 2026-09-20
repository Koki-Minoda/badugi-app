import {test,expect} from '@playwright/test';
import {APP_URL,createAuthenticatedSession,deleteAuthenticatedSession} from './authHelper';
for(const recoverable of [true,false])test(`Tournament save under storage pressure: ${recoverable?'recover':'notify'}`,async({page})=>{
 const session=await createAuthenticatedSession(page);
 try{
  await page.addInitScript(()=>{if(!localStorage.getItem('mgx.tournament.v2'))localStorage.setItem('mgx.tournament.v2',JSON.stringify({version:2,tournament:{bankroll:0,stageWins:{store:0,local:0,national:0,world:0},completedTournaments:[],history:[],lastResult:null},career:{statistics:{},worldChampionship:{cleared:true}},rivals:{},_meta:{}}));});
  await page.goto(`${APP_URL}multigame`);
  await page.evaluate(recoverable=>{
   localStorage.setItem('rl_hand_histories_v1',JSON.stringify({marker:'old',data:'old'.repeat(100)})+'\n'+JSON.stringify({marker:'newest'}));
   const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,value){
    if(key==='mgx.tournament.mtt.active'&&(!recoverable||(this.getItem('rl_hand_histories_v1')||'').includes('\"marker\":\"old\"')))throw new DOMException('QA quota pressure','QuotaExceededError');
    return original.call(this,key,value);
   };
  },recoverable);
  await page.getByTestId('multi-format-stage').click();
  await page.getByTestId('multi-start').click();
  await expect(page.getByTestId('mobile-play-layout')).toBeVisible();
  if(recoverable){
   await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mgx.tournament.mtt.active')||'null')?.version)).toBe(1);
   const logs=await page.evaluate(()=>localStorage.getItem('rl_hand_histories_v1')||'');
   expect(logs).not.toContain('\"marker\":\"old\"');expect(logs).toContain('\"marker\":\"newest\"');
   await expect(page.getByTestId('save-failure-notice')).toHaveCount(0);
   await page.goto(`${APP_URL}multigame`);await expect(page.getByTestId('multi-continue')).toBeVisible();
   await page.getByTestId('multi-continue').click();await expect(page.getByTestId('mobile-play-layout')).toBeVisible();
  }else{
   await expect(page.getByTestId('save-failure-notice')).toContainText('保存できません');
   expect(await page.evaluate(()=>localStorage.getItem('mgx.tournament.mtt.active'))).toBeNull();
   await page.getByTestId('save-failure-notice').getByRole('button',{name:'閉じる'}).click();await expect(page.getByTestId('save-failure-notice')).toHaveCount(0);
  }
 }finally{await deleteAuthenticatedSession(page,session);}
});
