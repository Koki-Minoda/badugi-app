function normalizeInvestment(player = {}) {
  return Math.max(0, Number(player.totalInvested ?? 0) || 0);
}

function isEligibleWinner(player = {}) {
  return Boolean(player) && !player.folded && !player.seatOut && !player.sittingOut;
}

export function buildContributionPots(players = []) {
  const investments = players.map((player, seatIndex) => ({
    seatIndex,
    invested: normalizeInvestment(player),
    player,
  }));
  const levels = [...new Set(investments.map((entry) => entry.invested).filter((value) => value > 0))]
    .sort((a, b) => a - b);
  const pots = [];
  let previous = 0;
  levels.forEach((level) => {
    const contributors = investments.filter((entry) => entry.invested >= level);
    const amount = (level - previous) * contributors.length;
    if (amount > 0) {
      pots.push({
        potIndex: pots.length,
        amount,
        potAmount: amount,
        contributorSeatIndexes: contributors.map((entry) => entry.seatIndex),
        eligibleSeatIndexes: contributors
          .filter((entry) => isEligibleWinner(entry.player))
          .map((entry) => entry.seatIndex),
      });
    }
    previous = level;
  });
  return pots;
}

export function splitAmountBySeatOrder(amount, winners = []) {
  const normalizedWinners = [...winners].sort((a, b) => a.seatIndex - b.seatIndex);
  if (!normalizedWinners.length || amount <= 0) return [];
  const base = Math.floor(amount / normalizedWinners.length);
  let remainder = amount - base * normalizedWinners.length;
  return normalizedWinners.map((entry) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return {
      ...entry,
      payout: base + extra,
    };
  });
}

export function resolveEvaluationPot({
  amount,
  eligibleSeatIndexes = [],
  evaluations = [],
  compareEvaluations,
} = {}) {
  const eligible = new Set(eligibleSeatIndexes);
  const contenders = evaluations.filter((entry) => eligible.has(entry.player?.seatIndex));
  if (!contenders.length || amount <= 0) return [];
  const best = contenders.reduce(
    (currentBest, entry) =>
      !currentBest || compareEvaluations(entry.evaluation, currentBest.evaluation) < 0
        ? entry
        : currentBest,
    null,
  );
  const winners = contenders.filter(
    (entry) => compareEvaluations(entry.evaluation, best.evaluation) === 0,
  );
  return splitAmountBySeatOrder(amount, winners);
}

export function applyPayoutsToPlayers(players = [], payouts = []) {
  payouts.forEach((payout) => {
    const player = players[payout.player?.seatIndex ?? payout.seatIndex];
    if (player) {
      player.stack = (player.stack ?? 0) + (payout.payout ?? 0);
    }
  });
}

export function summarizePayouts(payouts = []) {
  const bySeat = new Map();
  payouts.forEach((entry) => {
    const seatIndex = entry.player?.seatIndex ?? entry.seatIndex;
    if (typeof seatIndex !== "number") return;
    const current = bySeat.get(seatIndex);
    bySeat.set(seatIndex, {
      seatIndex,
      name: entry.player?.name ?? entry.name ?? `Seat ${seatIndex + 1}`,
      payout: (current?.payout ?? 0) + (entry.payout ?? 0),
      evaluation: current?.evaluation ?? entry.evaluation ?? null,
    });
  });
  return [...bySeat.values()].sort((a, b) => a.seatIndex - b.seatIndex);
}

function contributionPotsOrFallback(players, totalPot, evaluations) {
  const contributionPots = buildContributionPots(players);
  if (contributionPots.length) return contributionPots;
  return [{
    potIndex: 0,
    amount: totalPot,
    potAmount: totalPot,
    eligibleSeatIndexes: evaluations.map((entry) => entry.player.seatIndex),
  }];
}

function payoutSummary(entry) {
  return {
    seatIndex: entry.player.seatIndex,
    name: entry.player.name,
    payout: entry.payout,
    evaluation: entry.evaluation,
  };
}

export function resolveHighContributionPots({
  players = [],
  evaluations = [],
  compareEvaluations,
  totalPot = 0,
} = {}) {
  const payouts = [];
  const potDetails = contributionPotsOrFallback(players, totalPot, evaluations)
    .map((pot, potIndex) => {
      const potPayouts = resolveEvaluationPot({
        amount: pot.amount,
        eligibleSeatIndexes: pot.eligibleSeatIndexes,
        evaluations,
        compareEvaluations,
      });
      payouts.push(...potPayouts);
      return {
        potIndex: pot.potIndex ?? potIndex,
        amount: pot.amount,
        potAmount: pot.amount,
        eligibleSeatIndexes: [...(pot.eligibleSeatIndexes ?? [])],
        winnerSeatIndexes: potPayouts.map((winner) => winner.player.seatIndex),
        winners: potPayouts.map(payoutSummary),
      };
    });
  return { payouts, potDetails };
}

export function resolveHiLoContributionPots({
  players = [],
  highEvaluations = [],
  lowEvaluations = [],
  compareHighEvaluations,
  compareLowEvaluations,
  totalPot = 0,
} = {}) {
  const payouts = [];
  const potDetails = contributionPotsOrFallback(players, totalPot, highEvaluations)
    .map((pot, potIndex) => {
      const eligible = new Set(pot.eligibleSeatIndexes ?? []);
      const eligibleLow = lowEvaluations.filter((entry) => eligible.has(entry.player.seatIndex));
      const highAmount = eligibleLow.length ? Math.ceil(pot.amount / 2) : pot.amount;
      const lowAmount = eligibleLow.length ? pot.amount - highAmount : 0;
      const highPayouts = resolveEvaluationPot({
        amount: highAmount,
        eligibleSeatIndexes: pot.eligibleSeatIndexes,
        evaluations: highEvaluations,
        compareEvaluations: compareHighEvaluations,
      });
      const lowPayouts = resolveEvaluationPot({
        amount: lowAmount,
        eligibleSeatIndexes: pot.eligibleSeatIndexes,
        evaluations: lowEvaluations,
        compareEvaluations: compareLowEvaluations,
      });
      payouts.push(...highPayouts, ...lowPayouts);
      return {
        potIndex: pot.potIndex ?? potIndex,
        amount: pot.amount,
        potAmount: pot.amount,
        eligibleSeatIndexes: [...(pot.eligibleSeatIndexes ?? [])],
        highWinners: highPayouts.map(payoutSummary),
        lowWinners: lowPayouts.map(payoutSummary),
      };
    });
  return { payouts, potDetails };
}
