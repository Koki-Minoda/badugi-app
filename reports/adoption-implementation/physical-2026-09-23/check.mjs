import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {connectDevice} from '../../gameplay-device/iphone-client.mjs';
import {clickDeviceId} from '../../gameplay-device/physical-features.mjs';
import {measureMobileLayout} from '../../gameplay-device/mobile-layout-check.mjs';
import {PUBLIC_PLAYABLE_VARIANTS} from '../../../src/games/config/variantAvailability.js';
const c=await connectDevice(), rows=[];
const label=process.env.MGX_QA_LABEL||'portrait';
const save=()=>writeFile(new URL(`./${label}.json`,import.meta.url),JSON.stringify({date:new Date().toISOString(),method:'Physical iPhone Safari via USB Web Inspector; DOM activation and hit tests, not native finger taps',rows,errors:c.errors,transportErrors:c.fixtureErrors},null,2));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function geometry(){return c.evaluate(()=>({width:innerWidth,height:innerHeight,visualHeight:visualViewport.height,overflow:document.documentElement.scrollWidth>innerWidth,smallSelects:[...document.querySelectorAll('select')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<44).map(e=>({label:e.getAttribute('aria-label'),height:e.getBoundingClientRect().height}))}));}
try{await c.start();await c.navigate('/try');
c.navigate=async path=>{await c.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));},path);await pause(350);};
if(!process.env.MGX_ONLY_GAMES){
for(const language of ['ja','en']){
 await c.field('言語 / Language',language);
 for(const route of ['/try','/tools','/tools?tab=clock','/tools?tab=recommend','/learn/practice','/learn/review','/history','/tournament','/meetups','/mixed','/games','/dealers-choice','/multigame','/career','/friend-match']){
  await c.navigate(route);await pause(200);const row={type:'screen',language,route,...await geometry()};rows.push(row);await save();console.log(JSON.stringify(row));
  assert.equal(row.overflow,false);assert.deepEqual(row.smallSelects,[]);
 }
}
await c.field('言語 / Language','ja');
}
const variants=PUBLIC_PLAYABLE_VARIANTS.filter(v=>!process.env.MGX_VARIANTS||process.env.MGX_VARIANTS.split(',').includes(v.id));
for(const v of variants){const row={type:'game',id:v.id,actions:[],layoutIssues:[],tones:[],done:false};rows.push(row);await save();
try{await c.navigate('/try');await c.navigate(`/game?trial=1&variant=${v.availabilityKey}`);const stats=()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/history|rating|progress|heroTracker|bankroll|ofc.session/i.test(k)));const before=await c.evaluate(stats);const apiStart=c.apiResponses.length;
for(let i=0;i<600;i++){
 const state=await c.evaluate(()=>({done:[...document.querySelectorAll('[data-testid="hand-result-overlay"],[data-testid="ofc-result"],[data-testid="chinese-result-summary"]')].some(e=>e.getClientRects().length),layout:!!document.querySelector('[data-testid=mobile-play-layout]'),tone:document.querySelector('[data-testid=mobile-play-layout]')?.dataset.phaseTone}));
 if(state.done){row.done=true;break;}
 if(state.layout){const g=await c.evaluate(measureMobileLayout);row.layoutIssues.push(...g.issues.filter(x=>!row.layoutIssues.includes(x)));if(state.tone&&!row.tones.includes(state.tone)){row.tones.push(state.tone);await c.shot(`0923-${label}-${v.id}-${state.tone}`);}}
 const action=await c.evaluate(()=>{
  const ids=['ofc-suggest','ofc-confirm','action-call','action-check','action-draw-selected','action-stand-pat','action-bring-in','action-complete'];
  const submit=document.querySelector('[data-testid=chinese-submit]');if(submit&&!submit.disabled&&submit.getClientRects().length){const auto=[...document.querySelectorAll('button')].find(e=>/^自動配置$|^Auto Arrange$/.test(e.textContent.trim()));if(auto){auto.click();return 'chinese-auto';}}
  return ids.find(id=>{const e=document.querySelector(`[data-testid="${id}"]`);return e&&!e.disabled&&e.getClientRects().length;});
 });
 if(action==='chinese-auto'){await clickDeviceId(c,'chinese-submit');row.actions.push(action,'chinese-submit');}
 else if(action){if(action==='action-draw-selected'){const card=await c.evaluate(()=>document.querySelector('[data-testid=player-0-card-0]')?.tagName==='BUTTON');if(card)await clickDeviceId(c,'player-0-card-0');}await clickDeviceId(c,action);row.actions.push(action);if(action==='ofc-suggest'){await clickDeviceId(c,'ofc-confirm');row.actions.push('ofc-confirm');}}
 await pause(180);
}
row.geometry=await geometry();row.statsUnchanged=JSON.stringify(before)===JSON.stringify(await c.evaluate(stats));row.writes=c.apiResponses.slice(apiStart).filter(r=>!['GET','OPTIONS'].includes(r.method));await c.shot(`0923-${label}-${v.id}-result`);row.status=row.done&&row.actions.length>0&&!row.layoutIssues.length&&!row.geometry.overflow&&row.statsUnchanged&&!row.writes.length?'PASS':'FAIL';
}catch(e){row.error=String(e);row.status='FAIL';}await save();console.log(JSON.stringify(row));}
}finally{await save();await c.close();}
