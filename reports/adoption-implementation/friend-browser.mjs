import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
const origin='http://127.0.0.1:4181';
const browser=await chromium.launch({headless:true});
const report=[]; const out=new URL('./artifacts/',import.meta.url); await mkdir(out,{recursive:true});
try {
 for(const [variant,seats] of [['badugi',2],['ace_to_five_triple_draw',3],['deuce_to_seven_triple_draw',6]]) {
  const people=[]; const errors=[];
  for(let i=0;i<seats;i++) {
   const context=await browser.newContext({viewport:i%2?{width:844,height:390}:{width:390,height:844}});
   const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
   const email=`mgx.adoption.${variant}.${Date.now()}.${i}@example.com`, password='MgxAdoption!2026';
   const signup=await page.request.post(origin+'/api/auth/signup',{data:{email,password}});assert(signup.ok(),await signup.text());
   const login=await page.request.post(origin+'/api/auth/login',{data:{email,password}});assert(login.ok());
   const {access_token:token}=await login.json();const user=await (await page.request.get(origin+'/api/auth/me',{headers:{Authorization:`Bearer ${token}`}})).json();
   await page.addInitScript(({token,user,email})=>localStorage.setItem('mgx_auth',JSON.stringify({accessToken:token,tokenType:'Bearer',user:{...user,email},isAuthenticated:true})),{token,user,email});
   await page.goto(origin+'/friend-match');people.push({context,page,user,token});
  }
  const host=people[0].page;
  await host.locator(`label:has(input[value="${variant}"])`).click();
  await host.locator('#friend-seats').fill(String(seats));
  await host.getByRole('button',{name:/ルームを作成|Create Room/i}).click();
  const code=await host.getByTestId('p2p-room-code').textContent({timeout:15000});
  for(const {page} of people.slice(1)) {await page.getByLabel(/ルームコード|Room code/).fill(code);await page.getByRole('button',{name:/^参加$|^Join$/}).click();await page.getByTestId('p2p-ready').waitFor();}
  for(const {page} of people) await page.getByTestId('p2p-ready').click();
  await host.getByTestId('p2p-private-hand').waitFor();
  let step=0;let reconnected=false;let snapshots=[];
  for(;step<100;step++) {
   // One authoritative snapshot per turn. The action itself is always a visible browser button.
   const state=await (await host.request.get(`${origin}/api/p2p/rooms/${code}/state`,{headers:{Authorization:`Bearer ${people[0].token}`}})).json();
   const s=state.data??state;
   assert.equal(s.variantId,variant);assert.equal(s.players.length,seats);
   if(s.phase==='showdown') {assert.equal(s.players.reduce((sum,p)=>sum+p.stack,0),seats*2000);snapshots.push({phase:s.phase,pot:s.showdown.pot});break;}
   if(step===5&&!reconnected){await people[1].page.reload();await people[1].page.getByTestId('p2p-private-hand').waitFor();reconnected=true;}
   const actor=people.find(p=>String(p.user.id)===String(s.currentTurnPlayerId));assert(actor,`actor known: ${JSON.stringify({actor:s.currentTurnPlayerId,users:people.map(p=>p.user.id),phase:s.phase})}`);
   const ids=s.phase.startsWith('draw')?['p2p-draw']:['p2p-call','p2p-check'];
   let chosen;
   for(let tries=0;tries<40&&!chosen;tries++) {for(const id of ids){const b=actor.page.getByTestId(id);if(await b.count()&&await b.isEnabled()){chosen=b;break;}}if(!chosen)await actor.page.waitForTimeout(100);}
   assert(chosen,'legal action visible');
   if(s.phase.startsWith('draw')) { const card=actor.page.getByTestId('p2p-card-0');await card.click(); }
   if(step===0||s.phase==='draw1') {
    for(let i=0;i<people.length;i++){const p=people[i].page;assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(step===0&&i<2)await p.screenshot({path:new URL(`${variant}-${i}.png`,out).pathname});}
   }
   await chosen.click();await host.waitForTimeout(400);
   snapshots.push({phase:s.phase,step});
  }
  assert(step<100,'hand completed');assert.deepEqual(errors,[]);
  report.push({variant,seats,steps:step,reconnected,errors,phases:[...new Set(snapshots.map(s=>s.phase))]});
  console.log(JSON.stringify(report.at(-1)));
  for(const p of people)await p.context.close();
 }
} finally {await writeFile(new URL('./friend-browser.json',import.meta.url),JSON.stringify(report,null,2)+'\n');await browser.close();}
