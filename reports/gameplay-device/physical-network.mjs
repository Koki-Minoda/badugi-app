import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {clickDeviceId} from './physical-features.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function monitorNetwork(){
 const Native=window.WebSocket,fetchOriginal=window.fetch.bind(window);
 window.__mgxNetworkQa={sockets:[],states:[],http:[],blockWs:false,blockHttp:false};
 class ObservedSocket extends Native{
  constructor(...args){if(window.__mgxNetworkQa.blockWs)throw new Error('QA socket interruption');super(...args);window.__mgxNetworkQa.sockets.push(this);this.addEventListener('message',e=>{try{const m=JSON.parse(e.data);if(m.event==='state')window.__mgxNetworkQa.states.push(m.payload);}catch{}});}
 }
 window.WebSocket=ObservedSocket;
 window.fetch=async(...args)=>{
  const url=String(args[0]?.url??args[0]);if(!url.includes('/api/p2p/'))return fetchOriginal(...args);
  if(window.__mgxNetworkQa.blockHttp)throw new TypeError('Load failed (QA interruption)');
  const response=await fetchOriginal(...args);const state=await response.clone().json().catch(()=>null);
  window.__mgxNetworkQa.http.push({method:args[1]?.method??'GET',status:response.status,phase:state?.phase});
  if(state?.handId)window.__mgxNetworkQa.states.push(state);return response;
 };
}
const readView=()=>({
 cards:[...document.querySelectorAll('[data-testid=p2p-private-hand] button')].map(e=>e.textContent.trim()),
 actions:[...document.querySelectorAll('button[data-testid^="p2p-"]')].filter(e=>!e.disabled&&e.getClientRects().length).map(e=>e.dataset.testid),
 connected:[...document.querySelectorAll('strong')].some(e=>e.textContent.trim()==='connected'),
 polling:document.body.innerText.includes('polling'),
 result:/ショーダウン勝者|Showdown winner/.test(document.body.innerText),
 overflow:document.documentElement.scrollWidth-innerWidth,
 state:window.__mgxNetworkQa?.states.at(-1),
});
export async function auditPhysicalNetwork(c,{outputName='physical-network'}={}){
 const result={updated:new Date().toISOString(),status:'RUNNING',method:'iPhone Safari DOM controls + second Chromium player; local real API/WebSocket; deliberate transport interruption, not radio switching',steps:[]};
 const save=()=>writeFile(new URL(`./artifacts/${outputName}.json`,import.meta.url),JSON.stringify(result,null,2));
 const browser=await chromium.launch({headless:true});const guest=await browser.newPage({viewport:{width:393,height:695}});let token,roomCode;
 try{
  const email=`mgx-device-peer-${Date.now()}@example.com`,password='DevicePeer!2026';
  let response=await fetch('http://127.0.0.1:8011/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(response.ok,true);
  response=await fetch('http://127.0.0.1:8011/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(response.ok,true);token=(await response.json()).access_token;
  const user=await (await fetch('http://127.0.0.1:8011/api/auth/me',{headers:{Authorization:`Bearer ${token}`}})).json();
  await guest.addInitScript(({token,user,email})=>localStorage.setItem('mgx_auth',JSON.stringify({accessToken:token,tokenType:'Bearer',user:{...user,email},isAuthenticated:true})),{token,user,email});
  await c.navigate('/dev/friend-match');await c.evaluate(monitorNetwork);await c.click('ルームを作成');
  roomCode=await c.until(()=>[...document.querySelectorAll('strong')].map(e=>e.textContent.trim()).find(t=>/^[A-Z2-9]{6}$/.test(t)));
  await guest.goto('http://127.0.0.1:4179/dev/friend-match');await guest.evaluate(monitorNetwork);
  await guest.getByLabel(/Room code|ルームコード/i).fill(roomCode);await guest.getByRole('button',{name:/^Join$|^参加$/}).click();
  await c.until(()=>[...document.querySelectorAll('strong')].some(e=>e.textContent.trim()==='connected'));
  await clickDeviceId(c,'p2p-ready');await guest.getByTestId('p2p-ready').click();
  const initial=await c.until(()=>{const cards=[...document.querySelectorAll('[data-testid=p2p-private-hand] button')].map(e=>e.textContent.trim());return cards.length===4?cards:false;});
  await guest.getByTestId('p2p-card-3').waitFor();const peer=await guest.evaluate(readView);
  assert.equal(initial.filter(x=>peer.cards.includes(x)).length,0);
  for(const view of [await c.evaluate(readView),peer]){assert.equal(view.cards.length,4);assert.ok(view.state);assert.ok(view.state.players.every(p=>!('hand' in p)));assert.ok(view.overflow<=1);}
  result.viewport=await c.evaluate(()=>({width:innerWidth,height:innerHeight}));
  const controls=await c.evaluate(()=>({minButtonHeight:Math.min(...[...document.querySelectorAll('[data-testid=friend-match-layout] button')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().height)),minInputFont:Math.min(...[...document.querySelectorAll('[data-testid=friend-match-layout] input')].map(e=>parseFloat(getComputedStyle(e).fontSize)))}));
  assert.ok(controls.minButtonHeight>=44);assert.ok(controls.minInputFont>=16);result.controls=controls;
  result.steps.push('Real room created/joined; both private hands; opposing hands absent from received player state');await save();
  await c.evaluate(()=>window.__mgxNetworkQa.sockets.forEach(s=>s.close(4000,'QA reconnect')));
  await c.until(()=>window.__mgxNetworkQa.sockets.filter(s=>s.readyState===1).length===1&&window.__mgxNetworkQa.sockets.length>=2,undefined,15000);
  assert.deepEqual((await c.evaluate(readView)).cards,initial);result.steps.push('Closed live socket; automatic reconnect preserved cards');await save();
  await c.evaluate(()=>{window.__mgxNetworkQa.blockWs=true;window.__mgxNetworkQa.sockets.forEach(s=>s.close(4000,'QA fallback'));});
  await c.until(()=>document.body.innerText.includes('polling'),undefined,20000);
  result.steps.push('Repeated WebSocket failure switched iPhone to REST polling');await save();
  const readsBefore=await c.evaluate(()=>window.__mgxNetworkQa.http.filter(x=>x.method==='GET'&&x.status===200).length);
  await c.evaluate(()=>{window.__mgxNetworkQa.blockHttp=true;});await delay(3500);
  await c.evaluate(()=>{window.__mgxNetworkQa.blockHttp=false;});
  await c.until(count=>window.__mgxNetworkQa.http.filter(x=>x.method==='GET'&&x.status===200).length>count,readsBefore,20000);
  assert.deepEqual((await c.evaluate(readView)).cards,initial);result.steps.push('Temporary HTTP interruption recovered without losing the hand');
  let drewHost=false,drewGuest=false,betAfterDraw=false;const deadline=Date.now()+90000;
  while(Date.now()<deadline){
   const host=await c.evaluate(readView),other=await guest.evaluate(readView);
   if(host.result){result.steps.push('Both players drew; bet/fold finished the hand through the fallback');break;}
   let actor,view;
   if(host.actions.some(a=>['p2p-call','p2p-check','p2p-draw','p2p-bet'].includes(a))){actor='host';view=host;}else{actor='guest';view=other;}
   let action;
   if(view.actions.includes('p2p-draw')){if(actor==='host'&&!drewHost){await clickDeviceId(c,'p2p-card-0');drewHost=true;}if(actor==='guest')drewGuest=true;action='p2p-draw';}
   else if(drewHost&&drewGuest&&betAfterDraw&&view.actions.includes('p2p-fold'))action='p2p-fold';
   else if(drewHost&&drewGuest&&view.actions.includes('p2p-bet')){action='p2p-bet';betAfterDraw=true;}
   else action=['p2p-call','p2p-check'].find(a=>view.actions.includes(a));
   if(action){if(actor==='host')await clickDeviceId(c,action);else await guest.getByTestId(action).click();}
   await delay(200);
  }
  assert.ok((await c.evaluate(readView)).result);assert.ok(drewHost&&drewGuest&&betAfterDraw);
  const view=await c.evaluate(readView);assert.ok(view.overflow<=1);
  const http=await c.evaluate(()=>window.__mgxNetworkQa.http);assert.ok(http.some(r=>r.method==='POST'&&r.status===200));
  result.transport={successfulReads:http.filter(r=>r.method==='GET'&&r.status===200).length,successfulCommands:http.filter(r=>r.method==='POST'&&r.status===200).length};
  await c.shot(`${outputName}-result`);
  const finalCards=view.cards;await c.navigate('/dev/friend-match');await c.until(()=>/ショーダウン勝者|Showdown winner/.test(document.body.innerText));
  assert.deepEqual((await c.evaluate(readView)).cards,finalCards);result.steps.push('Reload restored the room, final hand and result');result.status='PASS';
 }catch(error){result.status='FAIL';result.error=String(error);try{await c.shot(`${outputName}-failure`);}catch{}}
 finally{
  // QA globals are page-scoped and are discarded on navigation.
  await browser.close();
  if(roomCode)await c.evaluate(async roomCode=>{const token=JSON.parse(localStorage.getItem('mgx_auth')||'{}').accessToken;await fetch(`/api/p2p/rooms/${roomCode}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});},roomCode).catch(()=>{});
  if(token)await fetch('http://127.0.0.1:8011/api/auth/account',{method:'DELETE',headers:{Authorization:`Bearer ${token}`}}).catch(()=>{});
  await save();
 }
 return result;
}
