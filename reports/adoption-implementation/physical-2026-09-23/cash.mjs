import {connectDevice} from '../../gameplay-device/iphone-client.mjs';
import {auditPhysicalGames} from '../../gameplay-device/physical-games.mjs';
import {writeFile} from 'node:fs/promises';
const c=await connectDevice();let previous;
try{await c.start();previous=await c.evaluate(()=>localStorage.getItem('mgx.previewVariants'));const rows=await auditPhysicalGames(c,{ids:['badugi'],checkLayout:true,outputName:'0923-cash'});await writeFile(new URL('./cash.json',import.meta.url),JSON.stringify(rows,null,2));await c.navigate('/history');console.log(await c.evaluate(()=>({buttons:[...document.querySelectorAll('button,a')].map(e=>({text:e.textContent,id:e.dataset.testid})).slice(-25),headings:[...document.querySelectorAll('h1,h2')].map(e=>e.textContent)})));}finally{if(previous!==undefined)await c.evaluate(v=>v===null?localStorage.removeItem('mgx.previewVariants'):localStorage.setItem('mgx.previewVariants',v),previous);await c.close();}
