import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {replayOfcHistory} from '../../src/games/chinese/OpenFaceChineseController.js';
import {replayChinesePokerHistory} from '../../src/games/chinese/chinesePokerHistory.js';
export async function auditPhysicalChinese(c,{hands=3,outputName='physical-chinese-final'}={}) {
 const rows=[];
 const clickId=async id=>c.until(id=>{const e=document.querySelector(`[data-testid="${id}"]`);if(!e||e.disabled||!e.getClientRects().length)return false;e.scrollIntoView({block:'nearest'});e.click();return true;},id);
 for(const [id,profile] of [['chinese_poker','CP1'],['ofc','CP2']]){
  const row={id,status:'RUNNING',hands:[]};rows.push(row);
  try{
   await c.navigate('/');await clickId('title-enter-button');await clickId('menu-ring');
   await c.until(()=>!!document.querySelector('input[type=search]'));
   await c.evaluate(value=>{const e=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));},profile);
   await clickId(`game-selector-play-${id}`);
   await c.until(id=>!!document.querySelector(`[data-testid="${id==='ofc'?'ofc-screen':'chinese-poker-screen'}"]`),id);
   row.viewport=await c.evaluate(()=>({width:innerWidth,height:innerHeight}));
   if(id==='ofc' && await c.evaluate(()=>!!document.querySelector('[data-testid=ofc-result]')))await clickId('ofc-next');
   for(let h=0;h<hands;h++){
    if(id==='ofc'){
     for(let step=0;step<9;step++){
      if(await c.evaluate(()=>!!document.querySelector('[data-testid=ofc-result]')))break;
      await clickId('ofc-suggest');await clickId('ofc-confirm');
     }
     await c.until(()=>!!document.querySelector('[data-testid=ofc-result]'));
     const record=await c.evaluate(()=>JSON.parse(localStorage.getItem('mgx.ofc.history.v1'))[0]);
     assert.ok(replayOfcHistory(record).valid);assert.equal(record.result.points.reduce((a,b)=>a+b,0),0);
     row.hands.push({handId:record.handId,exactReplay:true,points:record.result.points});
    }else{
     await c.until(()=>{const e=[...document.querySelectorAll('button')].find(e=>/^(自動配置|Auto Arrange)$/.test(e.textContent.trim()));if(!e)return false;e.click();return true;});
     await clickId('chinese-submit');await c.until(()=>!!document.querySelector('[data-testid=chinese-results]'));
     const records=await c.evaluate(()=>JSON.parse(localStorage.getItem('mgx.chinesePokerHistory.v1')));
     const record=records[0];assert.ok(replayChinesePokerHistory(record).valid);
     row.hands.push({handId:record.handId,exactReplay:true});
    }
    assert.ok(await c.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=2));
    await c.shot(`${outputName}-${id}-${h}-result`);
    if(h<hands-1)await clickId(id==='ofc'?'ofc-next':'chinese-next-hand');
   }
   row.status='PASS';
  }catch(e){row.status='FAIL';row.error=String(e);}
  await writeFile(new URL(`./artifacts/${outputName}.json`,import.meta.url),JSON.stringify({updated:new Date().toISOString(),interaction:'physical Safari, DOM controls',rows},null,2));
 }
 return rows;
}
