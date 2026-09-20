export function measurePhaseTone(){
 const root=document.querySelector('[data-testid=mobile-play-layout]');
 const snapshot=window.__BADUGI_E2E__?.getStateSnapshot?.();
 // Controller state is current; the legacy phase can lag at a transition.
 const phase=String(snapshot?.controllerSnapshot?.phase??snapshot?.phase??'').toUpperCase();
 const felt=root?.querySelector('[data-testid=table-felt]');
 const style=felt&&getComputedStyle(felt),tone=root?.dataset.phaseTone,issues=[];
 if(['BET','DRAW','DRAWING'].includes(phase)){
  const expected=phase==='BET'?'bet':'draw';
  const rgb=style?.borderTopColor.match(/[\d.]+/g)?.map(Number)||[];
  const red=rgb.length>=3&&rgb[0]>rgb[1]+40&&rgb[0]>rgb[2]+40;
  if(tone!==expected)issues.push(`Phase ${phase} rendered as ${tone}`);
  if(red!==(expected==='draw'))issues.push(`Phase ${phase} has incorrect rail color ${style?.borderTopColor}`);
 }
 return {phase,tone,rail:style?.borderTopColor,felt:style?.backgroundImage,issues};
}

// The physical Web Inspector bridge cannot await promises inside evaluate.
// Recheck only a diagnostic phase lag: the DOM must retain the same tone while
// the diagnostic phase advances to it. A persistent or changed-tone mismatch fails.
export async function readSettledPhaseTone(client) {
 const first=await client.evaluate(measurePhaseTone);
 if(!first.issues.length)return first;
 await new Promise(resolve=>setTimeout(resolve,75));
 const next=await client.evaluate(measurePhaseTone);
 if(!next.issues.length&&first.phase!==next.phase&&first.tone===next.tone&&first.rail===next.rail)
  return {...next,diagnosticTransition:{from:first.phase,to:next.phase,tone:first.tone}};
 return first;
}
