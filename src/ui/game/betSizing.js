function chips(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function uniquePresets(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!Number.isFinite(item.amount) || seen.has(item.amount)) return false;
    seen.add(item.amount);
    return true;
  });
}

export function buildBetSizingModel({
  structure,
  currentBet = 0,
  heroBet = 0,
  heroStack = 0,
  pot = 0,
  bigBlind = 1,
  lastFullRaiseSize = 0,
} = {}) {
  if (structure !== "no-limit" && structure !== "pot-limit") {
    return { enabled: false };
  }

  const tableBet = chips(currentBet);
  const committed = chips(heroBet);
  const stack = chips(heroStack);
  const potBeforeAction = chips(pot);
  const blind = Math.max(1, chips(bigBlind));
  const toCall = Math.max(0, tableBet - committed);
  const actionType = tableBet > 0 ? "raise" : "bet";
  const minimumRaiseSize = tableBet > 0
    ? Math.max(blind, chips(lastFullRaiseSize))
    : blind;
  const minimumFullCommit = toCall + minimumRaiseSize;
  const minCommit = Math.min(stack, minimumFullCommit);
  const potLimitMax = toCall > 0
    ? potBeforeAction + 2 * toCall
    : Math.max(blind, potBeforeAction);
  const maxCommit = Math.max(
    0,
    Math.min(stack, structure === "pot-limit" ? potLimitMax : stack),
  );
  const effectiveMin = Math.min(minCommit, maxCommit);
  const halfPotCommit = toCall + Math.round((potBeforeAction + toCall) * 0.5);
  const fullPotCommit = toCall > 0 ? potBeforeAction + 2 * toCall : potBeforeAction;
  const clamp = (value) => Math.max(effectiveMin, Math.min(maxCommit, chips(value)));
  const presets = uniquePresets([
    { key: "min", label: "Min", amount: effectiveMin },
    { key: "half-pot", label: "1/2 Pot", amount: clamp(halfPotCommit) },
    { key: "pot", label: "Pot", amount: clamp(fullPotCommit) },
    ...(structure === "no-limit"
      ? [{ key: "all-in", label: "All-in", amount: maxCommit }]
      : []),
  ]).filter((item) => item.amount > toCall || item.amount === stack);

  return {
    enabled: maxCommit > 0 && maxCommit >= effectiveMin,
    structure,
    actionType,
    toCall,
    minCommit: effectiveMin,
    maxCommit,
    minimumRaiseSize,
    presets,
  };
}
