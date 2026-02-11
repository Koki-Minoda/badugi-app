export function applyChips(player, amount) {
  if (!player || amount <= 0) return 0;
  const stack = Math.max(0, player.stack ?? 0);
  const applied = Math.min(stack, amount);
  if (applied <= 0) return 0;
  // Example check: blinds=30 plus call/raise => totalInvested > 30, pot grows accordingly.
  player.stack = stack - applied;
  player.totalInvested = (player.totalInvested ?? 0) + applied;
  return applied;
}
