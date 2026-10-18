export function measureMobileLayout(){
 const root=document.querySelector('[data-testid=mobile-play-layout]');
 if(!root)return {missing:true,issues:['Unified mobile layout missing']};
 const issues=[];
 const seats=[...root.querySelectorAll('.mgx-table-seat')].map(e=>({e,id:e.dataset.testid,r:e.getBoundingClientRect()}));
 for(let i=0;i<seats.length;i++){
  const a=seats[i];if(a.r.y<-.5||a.r.bottom>innerHeight+.5||a.r.x<-.5||a.r.right>innerWidth+.5)issues.push(`${a.id} outside viewport`);
  for(let j=i+1;j<seats.length;j++){const b=seats[j];if(Math.min(a.r.right,b.r.right)-Math.max(a.r.x,b.r.x)>1&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.y,b.r.y)>1)issues.push(`${a.id} overlaps ${b.id}`);}
  const heading=a.e.querySelector('.mgx-seat-heading')?.getBoundingClientRect();
  if(heading&&(heading.x<a.r.x-1||heading.right>a.r.right+1||heading.y<a.r.y-1||heading.bottom>a.r.bottom+1))issues.push(`${a.id} nameplate outside seat`);
  const name=a.e.querySelector('.mgx-seat-name')?.getBoundingClientRect(),stack=a.e.querySelector('.mgx-seat-heading strong')?.getBoundingClientRect();
  if(name&&stack&&Math.min(name.right,stack.right)-Math.max(name.x,stack.x)>1&&Math.min(name.bottom,stack.bottom)-Math.max(name.y,stack.y)>1)issues.push(`${a.id} name overlaps stack`);
  for(const card of a.e.querySelectorAll('.mgx-table-card')){const r=card.getBoundingClientRect();if(r.x<a.r.x-1||r.right>a.r.right+1||r.y<a.r.y-1||r.bottom>a.r.bottom+1)issues.push(`${card.dataset.testid} outside seat`);
   const rank=card.querySelector('b')?.getBoundingClientRect();if(rank&&rank.width>r.width-1)issues.push(`${card.dataset.testid} rank clipped`);
   if(card.tagName==='BUTTON'&&(r.width<43.5||r.height<44||!card.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))))issues.push(`${card.dataset.testid} draw target inaccessible`);
  }
 }
 const felt=root.querySelector('[data-testid=table-felt]');
 if(!felt)issues.push('Oval felt missing');
 const community=root.querySelector('.mgx-community')?.getBoundingClientRect();
 if(community)for(const {id,r} of seats)if(Math.min(r.right,community.right)-Math.max(r.x,community.x)>1&&Math.min(r.bottom,community.bottom)-Math.max(r.y,community.y)>1)issues.push(`${id} overlaps pot or board`);
 for(const e of root.querySelectorAll('.mgx-play-actions button:not(:disabled)')){const r=e.getBoundingClientRect();if(r.height<44||r.y<0||r.bottom>innerHeight+1||!e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))issues.push(`${e.dataset.testid} inaccessible`);}
 return {issues,heroCards:root.querySelectorAll('.is-hero .mgx-table-card').length,boardCards:root.querySelectorAll('.mgx-board-cards .mgx-table-card').length};
}
