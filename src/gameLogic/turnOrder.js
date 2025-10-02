// returns array of action order indices starting from left of dealer (clockwise)
export function getActionOrder(dealerIdx, players){
  const order = [];
  for(let i=1;i<players.length;i++){
    const idx = (dealerIdx + i) % players.length;
    order.push(idx);
  }
  return order;
}
