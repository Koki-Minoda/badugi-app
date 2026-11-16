import { compareBadugiEvaluations, evaluateBadugi } from "../../games/badugi/utils/badugiEvaluator.js";
import { calledBetValue } from "./finalBetValue.js";

const suits = ["S", "H", "D", "C"];
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const deck = ranks.flatMap((rank) => suits.map((suit) => rank + suit));
const lowTriples = [["A", "2", "3"], ["A", "3", "4"], ["2", "3", "4"]];
const highTriples = [["5", "8", "9"], ["6", "8", "10"], ["7", "9", "J"]];
const lowMade = [["A", "2", "3", "6"], ["A", "3", "4", "7"], ["2", "3", "4", "8"]];
const highMade = [["4", "6", "8", "J"], ["5", "7", "9", "Q"], ["6", "8", "10", "K"]];

export const RANGE_MODELS = {
  onlyLow: { ja: "低い組み合わせに限定", en: "Low combinations only", lowWeight: 1 },
  low: { ja: "低い組み合わせが多い", en: "Mostly low combinations", lowWeight: 0.85 },
  balanced: { ja: "低い組み合わせと高い組み合わせが半々", en: "Balanced low/high combinations", lowWeight: 0.5 },
  high: { ja: "高い組み合わせが多い", en: "Mostly high combinations", lowWeight: 0.15 },
};

export const CLOSE_EV = 0.01; // Big bets; a teaching tolerance, not a confidence interval.
export const RETEST_DELAY = 3 * 24 * 60 * 60 * 1000;

const practice = [
  { cards: ["AS", "3H", "5D", "10C"], pot: 3, range: "onlyLow" },
  { cards: ["AS", "3H", "5D", "10C"], pot: 3, range: "onlyLow", opponentDraw: 0 },
  { cards: ["2H", "4C", "7S", "JD"], pot: 5, range: "onlyLow", opponentDraw: 0 },
  { cards: ["2H", "4C", "7S", "JD"], pot: 5, range: "high", opponentDraw: 0 },
  { cards: ["AS", "3H", "5D", "10C"], pot: 3, range: "low", opponentDraw: 0 },
];

const retest = [
  { cards: ["AH", "4S", "6C", "10D"], pot: 3, range: "onlyLow" },
  { cards: ["AH", "4S", "6C", "10D"], pot: 3, range: "onlyLow", opponentDraw: 0 },
  { cards: ["2C", "5S", "7D", "QH"], pot: 5, range: "onlyLow", opponentDraw: 0 },
  { cards: ["2C", "5S", "7D", "QH"], pot: 5, range: "high", opponentDraw: 0 },
  { cards: ["AH", "4S", "5C", "10D"], pot: 3, range: "low", opponentDraw: 0 },
];

const transfer = [
  { cards: ["AD", "4C", "6H", "JS"], pot: 4, range: "onlyLow", opponentDraw: 0 },
  { cards: ["AC", "3D", "6S", "JH"], pot: 4, range: "low", opponentDraw: 1 },
  { cards: ["3S", "5H", "7C", "10D"], pot: 2, range: "high", opponentDraw: 0 },
  { cards: ["AC", "2H", "6D", "QS"], pot: 5, range: "onlyLow", opponentDraw: 1 },
  { cards: ["AD", "5S", "6C", "QH"], pot: 5, range: "onlyLow", opponentDraw: 0 },
];

const transferRetest = [
  { cards: ["AS", "3H", "6D", "JC"], pot: 4, range: "onlyLow", opponentDraw: 0 },
  { cards: ["AD", "4H", "7C", "JS"], pot: 4, range: "low", opponentDraw: 1 },
  { cards: ["3C", "6D", "8S", "10H"], pot: 2, range: "high", opponentDraw: 0 },
  { cards: ["AS", "3H", "7D", "QC"], pot: 5, range: "onlyLow", opponentDraw: 1 },
  { cards: ["3D", "5S", "6H", "QC"], pot: 5, range: "onlyLow", opponentDraw: 0 },
];

export function finalDrawQuestions(mode) {
  if (mode === "retest") return retest;
  if (mode === "transfer") return transfer;
  if (mode === "transferRetest") return transferRetest;
  return practice;
}

function keptRange(templates, blocked) {
  let combinations = [];
  for (const template of templates) {
    let partial = [[]];
    for (const rank of template) {
      partial = partial.flatMap((cards) => suits
        .filter((suit) => !cards.some((card) => card.endsWith(suit)) && !blocked.has(rank + suit))
        .map((suit) => [...cards, rank + suit]));
    }
    combinations = combinations.concat(partial);
  }
  return combinations;
}

function showdownShare(hero, opponent) {
  const order = compareBadugiEvaluations(hero, opponent);
  return order < 0 ? 1 : order === 0 ? 0.5 : 0;
}

// EV in big bets at the decision node. Opponent keeps three distinct cards
// and draws one, or stands pat with four; future cards are enumerated without replacement.
// After drawing, opponent bets a T-or-better Badugi, otherwise checks.
// Hero checks back, or chooses call/fold using only the final hero hand and
// the observed bet. One bet only. Other unknown/dead cards are integrated
// out under the model's uniform-deck assumption.
export function evaluateFinalDraw({ cards, pot, range, opponentDraw = 1, knownDead = [] }) {
  const blocked = new Set([...cards, ...knownDead]);
  const model = RANGE_MODELS[range];
  if (!model || ![0, 1].includes(opponentDraw) || cards.length !== 4 || evaluateBadugi(cards).count !== 4 || !Number.isFinite(pot) || pot <= 0
    || blocked.size !== cards.length + knownDead.length || [...blocked].some((card) => !deck.includes(card))) {
    throw new TypeError("Expected a made Badugi, a positive pot in big bets, and a defined opponent range.");
  }

  const buckets = [
    { hands: keptRange(opponentDraw ? lowTriples : lowMade, blocked), weight: model.lowWeight },
    { hands: keptRange(opponentDraw ? highTriples : highMade, blocked), weight: 1 - model.lowWeight },
  ].filter(({ hands, weight }) => hands.length && weight > 0);
  const totalWeight = buckets.reduce((sum, bucket) => sum + bucket.weight, 0);
  if (!totalWeight) throw new TypeError("No opponent hands fit the known cards.");

  const heroPat = evaluateBadugi(cards);
  const available = deck.filter((card) => !blocked.has(card));
  if (available.length < 5) throw new TypeError("Too few unseen cards.");
  const heroDraws = cards.map((_, index) => new Map(available.map((card) => [
    card, evaluateBadugi([...cards.filter((_, i) => i !== index), card]),
  ])));
  const branches = [new Map(), ...cards.map(() => new Map())];

  function addOutcome(branch, observation, hero, opponent, weight, bets) {
    const share = showdownShare(hero, opponent);
    const totals = branch.get(observation) ?? { check: 0, call: 0 };
    if (bets) totals.call += weight * (calledBetValue(pot, 1, share));
    else totals.check += weight * share * pot;
    branch.set(observation, totals);
  }

  for (const { hands, weight } of buckets) {
    const keepWeight = weight / (totalWeight * hands.length);
    for (const kept of hands) {
      const unseen = available.filter((card) => !kept.includes(card));
      const opponentCards = opponentDraw ? unseen : [null];
      const opponentDrawWeight = keepWeight / opponentCards.length;
      const bothDrawWeight = opponentDrawWeight / (unseen.length - opponentDraw);
      for (const opponentCard of opponentCards) {
        const opponent = evaluateBadugi(opponentCard ? [...kept, opponentCard] : kept);
        const bets = opponent.count === 4 && opponent.kicker <= 10;
        addOutcome(branches[0], "pat", heroPat, opponent, opponentDrawWeight, bets);
        for (const heroCard of unseen) {
          if (heroCard === opponentCard) continue;
          heroDraws.forEach((draws, i) =>
            addOutcome(branches[i + 1], heroCard, draws.get(heroCard), opponent, bothDrawWeight, bets));
        }
      }
    }
  }

  const actions = branches.map((branch, index) => ({
    id: index === 0 ? "pat" : cards[index - 1],
    ev: [...branch.values()].reduce((sum, value) => sum + value.check + Math.max(0, value.call), 0),
  })).sort((a, b) => b.ev - a.ev);

  return {
    opponentHands: buckets.reduce((sum, { hands }) => sum + hands.length, 0),
    actions: actions.map((action) => ({ ...action, loss: Math.max(0, actions[0].ev - action.ev) })),
  };
}

export function finalDrawRangeExamples(opponentDraw = 1) {
  return (opponentDraw ? [lowTriples, highTriples] : [lowMade, highMade]).map((group) =>
    group.map((template) => template.join("–").replace("10", "T")).join(" / "));
}

export function summarizeFinalDrawAttempts(attempts) {
  return {
    meanLoss: attempts.reduce((sum, attempt) => sum + attempt.loss, 0) / attempts.length,
    closeChoices: attempts.filter((attempt) => attempt.loss <= CLOSE_EV).length,
    highConfidenceMisses: attempts.filter((attempt) => attempt.confidence === "high" && attempt.loss > CLOSE_EV).length,
    count: attempts.length,
  };
}

export function findFinalDrawReview(hands, userId) {
  let latest = null;
  for (const hand of hands) {
    const variant = String(hand?.variantId ?? "").toLowerCase();
    if (!["badugi", "d03"].includes(variant) || !hand.handId || !hand.endedAt || hand.guestTrial
      || hand.historySource === "guest" || (hand.userId != null && String(hand.userId) !== String(userId))
      || (latest && latest.endedAt >= hand.endedAt)) continue;
    const hero = hand.seats?.find((seat) => seat.isHero || seat.hero)?.seat ?? hand.heroSeat ?? 0;
    const draws = (hand.events ?? []).filter((event) => event.type === "DRAW_ACTION" && event.drawRoundIndex === 3);
    const [other, action] = draws;
    const active = other?.playersAfter?.filter((player) => !player.folded && !player.allIn && player.stack > 0);
    if (draws.length !== 2 || other.seat === hero || ![0, 1].includes(other.drawCount)
      || action.seat !== hero || ![0, 1].includes(action.drawCount) || !Number.isInteger(action.actionSeq)
      || active?.length !== 2 || !active.some((player) => player.seat === hero)
      || !active.some((player) => player.seat === other.seat)) continue;
    const cards = action.before?.map((card) => typeof card === "string" ? card.toUpperCase().replace(/^T/, "10") : "");
    const pot = other.potAfter / (2 * hand.level?.bb);
    if (cards?.length !== 4 || new Set(cards).size !== 4 || cards.some((card) => !deck.includes(card))
      || evaluateBadugi(cards).count !== 4 || !Number.isFinite(pot) || pot <= 0) continue;
    const discard = action.replacedCards?.[0]?.index ?? action.discarded?.[0];
    if (action.drawCount === 1 && !cards[discard]) continue;
    latest = {
      handId: hand.handId, endedAt: hand.endedAt, actionSeq: action.actionSeq,
      cards, pot, opponentDraw: other.drawCount, range: "balanced",
      actualAction: action.drawCount ? cards[discard] : "pat",
    };
  }
  return latest;
}
