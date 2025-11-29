// src/games/badugi/flow/handResultUtils.js

export const BADUGI_RANK_SYMBOLS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export function resolveEvaluationCount(evaluation) {
  if (evaluation && typeof evaluation.count === "number") return evaluation.count;
  switch (evaluation?.rankType) {
    case "BADUGI":
      return 4;
    case "THREE_CARD":
      return 3;
    case "TWO_CARD":
      return 2;
    case "ONE_CARD":
    default:
      return 1;
  }
}

export function formatBadugiHandLabel(evaluation) {
  const count = Math.max(0, resolveEvaluationCount(evaluation));
  if (count >= 4) return "Badugi 4-card";
  if (count > 0) return `Badugi ${count}-card`;
  return "Badugi";
}

export function formatBadugiRanksLabel(evaluation) {
  if (!evaluation || !Array.isArray(evaluation.ranks) || evaluation.ranks.length === 0) {
    return "-";
  }
  return evaluation.ranks
    .map((value) => BADUGI_RANK_SYMBOLS[value] ?? `${value}`)
    .join("-");
}

export function buildHandResultSummary({
  players = [],
  summary = [],
  totalPot,
  handId = null,
  evaluateHand,
}) {
  const evaluate = typeof evaluateHand === "function" ? evaluateHand : null;
  const potEntries = Array.isArray(summary) ? summary : [];
  const hydrateWinnerEntry = (entry, explicitSeat = null) => {
    const seatIndex =
      typeof explicitSeat === "number"
        ? explicitSeat
        : typeof entry?.seatIndex === "number"
        ? entry.seatIndex
        : typeof entry?.seat === "number"
        ? entry.seat
        : null;
    const playerState = typeof seatIndex === "number" ? players?.[seatIndex] : null;
    const playerHand = playerState?.hand ?? entry?.hand ?? [];
    const evaluation =
      entry?.evaluation && typeof entry.evaluation === "object"
        ? entry.evaluation
        : playerHand.length && evaluate
        ? evaluate(playerHand)
        : null;
    const activeCards =
      evaluation?.activeCards && evaluation.activeCards.length
        ? evaluation.activeCards
        : playerHand;
    const deadCards = evaluation?.deadCards ?? [];

    return {
      seatIndex,
      name: entry?.name ?? (typeof seatIndex === "number" ? `Seat ${seatIndex}` : "Unknown"),
      payout: Math.max(0, entry?.payout ?? 0),
      stack: playerState?.stack,
      hand: playerHand,
      handLabel: formatBadugiHandLabel(evaluation),
      ranksLabel: formatBadugiRanksLabel(evaluation),
      activeCards,
      deadCards,
    };
  };

  const rawPotDetails = potEntries.map((pot) => {
    const potAmount = Math.max(0, pot?.potAmount ?? pot?.amount ?? 0);
    const payouts = Array.isArray(pot?.payouts) ? pot.payouts : [];
    const winners = payouts.map((entry) => {
      const seatKey =
        typeof entry?.seatIndex === "number"
          ? entry.seatIndex
          : typeof entry?.seat === "number"
          ? entry.seat
          : null;
      return hydrateWinnerEntry(entry, seatKey);
    });
    return {
      potIndex: typeof pot?.potIndex === "number" ? pot.potIndex : null,
      potAmount,
      winners,
    };
  });

  const filteredPotDetails = rawPotDetails.filter(
    (pot) => pot.potAmount > 0 || (pot.winners ?? []).length > 0,
  );
  const potDetails = filteredPotDetails.length ? filteredPotDetails : rawPotDetails;

  const payoutSum = potDetails
    .flatMap((pot) => pot.winners)
    .reduce((acc, entry) => acc + (entry.payout ?? 0), 0);
  const potAmountFallback = potDetails.reduce((acc, pot) => acc + (pot.potAmount ?? 0), 0);
  const resolvedTotal =
    typeof totalPot === "number" && !Number.isNaN(totalPot)
      ? totalPot
      : Math.max(potAmountFallback, payoutSum);
  const winnerMap = new Map();
  potDetails.flatMap((pot) => pot.winners).forEach((entry) => {
    if (typeof entry.seatIndex !== "number") return;
    const existing = winnerMap.get(entry.seatIndex);
    const merged = existing
      ? {
          ...existing,
          payout: (existing.payout ?? 0) + (entry.payout ?? 0),
        }
      : { ...entry };
    winnerMap.set(entry.seatIndex, merged);
  });
  const winners = Array.from(winnerMap.values()).map((entry) => ({
    ...entry,
    payout: entry.payout ?? 0,
  }));
  return {
    handId: handId ?? null,
    pot: resolvedTotal,
    winners,
    potDetails: potDetails.length
      ? potDetails
      : winners.length
      ? [
          {
            potIndex: 0,
            potAmount: resolvedTotal,
            winners,
          },
        ]
      : [],
  };
}
