import { evaluateHand, compareEvaluations } from "../../evaluators/registry.js";

function convertResult(result) {
  const metadata = result?.metadata ?? {};
  const ranks = metadata.ranks ?? [];
  return {
    rankType:
      metadata.size === 4
        ? "BADUGI"
        : metadata.size === 3
        ? "THREE_CARD"
        : metadata.size === 2
        ? "TWO_CARD"
        : "ONE_CARD",
    ranks,
    kicker: ranks[ranks.length - 1] ?? 0,
    isBadugi: metadata.size === 4,
    metadata,
  };
}

export function evaluateBadugi(hand) {
  const result = evaluateHand({ cards: hand, gameType: "badugi" });
  return convertResult(result);
}

export function compareBadugi(handA, handB) {
  const evA = evaluateHand({ cards: handA, gameType: "badugi" });
  const evB = evaluateHand({ cards: handB, gameType: "badugi" });
  return compareEvaluations(evA, evB);
}

export function getBestBadugiPlayer(players) {
  if (!Array.isArray(players) || players.length === 0) return null;
  let best = players[0];
  for (const player of players) {
    if (compareBadugi(player.hand, best.hand) < 0) {
      best = player;
    }
  }
  return best;
}

export function getWinnersByBadugi(players) {
  if (!players || !players.length) return [];
  const evaluated = players.map((player) => {
    const result = evaluateHand({ cards: player.hand, gameType: "badugi" });
    return {
      ...player,
      eval: result,
    };
  });
  evaluated.sort((a, b) => compareEvaluations(a.eval, b.eval));
  const bestEval = evaluated[0]?.eval;
  const winners = evaluated.filter(
    (entry) => compareEvaluations(entry.eval, bestEval) === 0
  );
  console.log(
    "[SHOWDOWN] Evaluated order:",
    evaluated.map(
      (entry) =>
        `${entry.name} ${entry.eval.metadata.size}-card ${entry.eval.metadata.ranks.join("-")}`
    )
  );
  console.log("[SHOWDOWN] Winners:", winners.map((entry) => entry.name));
  return winners.map((winner) => ({
    seat: winner.seat ?? winner.seatIndex,
    seatIndex: winner.seatIndex ?? winner.seat,
    name: winner.name,
    hand: winner.hand,
    evaluation: winner.eval,
  }));
}
