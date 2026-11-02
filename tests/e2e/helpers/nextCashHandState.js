/** A still-visible overlay belongs to the next hand only when its own new ID is saved. */
export function classifyCashNextHand({overlayVisible,previousResultHandId,resultHandId,historyHandIds=[]}) {
  if(!overlayVisible)return 'active';
  if(!resultHandId||resultHandId===previousResultHandId)return 'previous';
  return historyHandIds.includes(resultHandId)?'settled':'transitioning';
}
