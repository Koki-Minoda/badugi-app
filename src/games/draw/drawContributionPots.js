import { buildContributionPots } from '../core/sidePotResolver.js';

// Draw engines accumulate street bets into a shared pot. At showdown, rebuild
// eligibility from the complete hand's contributions, including folded money.
// Keep explicit legacy pots when the snapshot lacks matching contribution data.
export function resolveDrawContributionPots(players = [], pots = []) {
  const contributionPots = buildContributionPots(players);
  const contributed = contributionPots.reduce((sum, pot) => sum + pot.amount, 0);
  const stored = pots.reduce((sum, pot) => sum + Math.max(0, Number(pot.amount) || 0), 0);
  if (contributed <= 0 || contributed !== stored) return pots;
  return contributionPots.map(pot => ({
    ...pot,
    eligiblePlayerIds: pot.eligibleSeatIndexes.map(seat => players[seat].playerId ?? players[seat].id),
  }));
}
