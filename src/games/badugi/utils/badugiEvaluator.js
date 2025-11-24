import { evaluateHand } from "../../evaluators/registry.js";

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
  const evA = evaluateBadugi(handA);
  const evB = evaluateBadugi(handB);
  return compareEvalResults(evA, evB);
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
  evaluated.sort((a, b) => {
    console.log(
      `[SHOWDOWN] Comparing ${a.name} (seat=${a.seat ?? a.seatIndex}) vs ${b.name} (seat=${b.seat ?? b.seatIndex}): ${a.eval.metadata.size ?? 0}-card ranks=${(
        a.eval.metadata.ranks ?? []
      ).join("-")} vs ${b.eval.metadata.size ?? 0}-card ranks=${(b.eval.metadata.ranks ?? []).join("-")}`
    );
    return compareEvalResults(a.eval, b.eval);
  });
  evaluated.forEach((entry) => {
    const meta = entry.eval.metadata ?? {};
    console.log(
      `[SHOWDOWN] seat=${entry.seat ?? entry.seatIndex} ${entry.name} size=${meta.size ?? 0} ranks=${meta.ranks?.join("-") ?? ""} cards=${meta.cards?.join(",") ?? ""}`
    );
  });
  const bestEval = evaluated[0]?.eval;
  const winners = evaluated.filter(
    (entry) => compareEvalResults(entry.eval, bestEval) === 0
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

function compareEvalResults(evA, evB) {
  const metaA = evA?.metadata ?? {};
  const metaB = evB?.metadata ?? {};
  const sizeA = typeof metaA.size === "number" ? metaA.size : 0;
  const sizeB = typeof metaB.size === "number" ? metaB.size : 0;
  if (sizeA !== sizeB) {
    return sizeB - sizeA;
  }
  const ranksA = Array.isArray(metaA.ranks) ? metaA.ranks : [];
  const ranksB = Array.isArray(metaB.ranks) ? metaB.ranks : [];
  const maxLen = Math.max(ranksA.length, ranksB.length);
  for (let i = maxLen - 1; i >= 0; i -= 1) {
    const ra = ranksA[i] ?? 0;
    const rb = ranksB[i] ?? 0;
    if (ra !== rb) {
      return rb - ra;
    }
  }
  return 0;
}
