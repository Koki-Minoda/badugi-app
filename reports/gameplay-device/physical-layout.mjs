import {clickDeviceId} from './physical-features.mjs';
import {writeFile} from 'node:fs/promises';
export async function openPhysicalVariant(c,id,profile){
 await c.navigate('/');await clickDeviceId(c,'title-enter-button');await clickDeviceId(c,'menu-ring');await c.until(()=>!!document.querySelector('input[type=search]'));
 await c.evaluate(value=>{const e=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));},profile);
 await clickDeviceId(c,`game-selector-play-${id}`);await new Promise(r=>setTimeout(r,1000));
}
export async function captureLayout(c,name){
 const layout=await c.evaluate(()=>({width:innerWidth,height:innerHeight,scroll:scrollY,seats:[...document.querySelectorAll('[data-testid]')].filter(e=>/^seat-\d+$/.test(e.dataset.testid)).map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.testid,x:r.x,y:r.y,width:r.width,height:r.height};}),controls:[...document.querySelectorAll('button[data-testid],input[data-testid],[data-testid=player-action-hint]')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.testid,text:e.textContent,x:r.x,y:r.y,width:r.width,height:r.height,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}),scrollers:(()=>{const a=[];let e=document.querySelector('[data-testid=seat-0]');while(e){if(e.scrollTop)a.push({tag:e.tagName,cls:e.className,scroll:e.scrollTop});e=e.parentElement;}return a;})()}));
 await c.shot(name);await writeFile(new URL(`./artifacts/${name}.json`,import.meta.url),JSON.stringify(layout,null,2));return layout;
}
