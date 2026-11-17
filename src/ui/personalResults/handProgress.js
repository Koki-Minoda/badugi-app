import { compareBadugiEvaluations, evaluateBadugi } from "../../games/badugi/utils/badugiEvaluator.js";

export const HAND_WINDOW = 50;
export const MIN_DECISIONS = 5;

function variantKey(hand) {
  const id = String(hand.variantId ?? hand.variant ?? "unknown").toLowerCase();
  return { d03: "badugi", d01: "deuce_to_seven_triple_draw" }[id] ?? id;
}

function validCards(cards) {
  return cards.length === 4 && cards.every((card) => typeof card === "string" && /^(10|[2-9TAJQK])[CDHS]$/i.test(card))
    && new Set(cards.map((card) => card.toUpperCase().replace(/^10/, "T"))).size === 4;
}

// Compare only card choices at the same draw count. The count and pat/break
// decision itself depend on the opponent, position, and the state of the hand.
export function bestBadugiKeep(cards, keepCount) {
  let best = null;
  for (let mask = 1; mask < 16; mask += 1) {
    const kept = cards.filter((_, index) => mask & (1 << index));
    if (kept.length !== keepCount) continue;
    const evaluation = evaluateBadugi(kept);
    if (!best || compareBadugiEvaluations(evaluation, best) < 0) best = evaluation;
  }
  return best;
}

function drawEvidence(hand) {
  if (variantKey(hand) !== "badugi") return [];
  const seats = Array.isArray(hand.seats) ? hand.seats : [];
  const hero = seats.find((seat) => seat?.isHero === true || seat?.hero === true)
    ?? seats.find((seat) => (seat?.seat ?? seat?.seatIndex) === (hand.heroSeat ?? hand.heroSeatIndex ?? 0));
  const seat = hero?.seat ?? hero?.seatIndex;
  const actions = hero?.actions;
  if (!Array.isArray(actions)) return [];

  return actions.flatMap((action, index) => {
    const seq = action.seq ?? action.actionSeq;
    const event = seq == null ? null : hand.events?.find((item) =>
      item.type === "DRAW_ACTION" && item.seat === seat && item.actionSeq === seq);
    const info = action.metadata?.drawInfo ?? action.drawInfo ?? event;
    const round = action.metadata?.drawRound ?? action.drawRound ?? info?.drawRoundIndex ?? info?.drawRound ?? event?.drawRoundIndex;
    const cards = info?.before;
    const draw = info?.drawIndexes ?? info?.discarded ?? info?.replacedCards?.map((card) => card.index);
    if (!Number.isInteger(round) || round < 1 || round > 3 || !Array.isArray(cards) || !validCards(cards)
      || !Array.isArray(draw) || draw.length < 1 || draw.length > 3
      || new Set(draw).size !== draw.length || draw.some((i) => !Number.isInteger(i) || i < 0 || i > 3)) return [];
    const kept = cards.filter((_, i) => !draw.includes(i));
    const best = bestBadugiKeep(cards, kept.length);
    return [{
      round: round - 1, handId: hand.handId, seq: seq ?? index + 1,
      correct: compareBadugiEvaluations(evaluateBadugi(kept), best) === 0,
    }];
  });
}

function score(decisions) {
  if (decisions.length < MIN_DECISIONS) return null;
  return Math.round(decisions.filter((decision) => decision.correct).length * 100 / decisions.length) / 10;
}

export function getPersonalResults(hands, userId = null) {
  const games = new Map();
  const seen = new Set();
  const chronological = [...hands].sort((a, b) => (a?.endedAt ?? a?.ts ?? 0) - (b?.endedAt ?? b?.ts ?? 0));
  for (const hand of chronological) {
    if (!hand?.handId || (userId != null && hand.userId != null && String(userId) !== String(hand.userId))
      || hand.historySource === "guest" || hand.guestTrial || seen.has(hand.handId)
      || !(hand.endedAt != null || hand.events?.some((event) => event.type === "HAND_END"))) continue;
    seen.add(hand.handId);
    const id = variantKey(hand);
    if (!games.has(id)) games.set(id, {
      id, label: id === "badugi" ? "Badugi" : hand.variantName ?? id, hands: [],
    });
    games.get(id).hands.push({ decisions: drawEvidence(hand) });
  }

  return [...games.values()].map(({ id, label, hands: entries }) => {
    const timeline = [];
    for (let start = 0; start < entries.length; start += HAND_WINDOW) {
      const end = Math.min(start + HAND_WINDOW, entries.length);
      const decisions = entries.slice(start, end).flatMap((hand) => hand.decisions);
      timeline.push({ start: start + 1, end, score: score(decisions), samples: decisions.length });
    }
    const latest = entries.slice(-HAND_WINDOW).flatMap((hand) => hand.decisions);
    const first = entries.length >= HAND_WINDOW * 2
      ? entries.slice(0, HAND_WINDOW).flatMap((hand) => hand.decisions)
      : [];
    const axes = [0, 1, 2].map((round) => {
      const decisions = latest.filter((decision) => decision.round === round);
      const baseline = first.filter((decision) => decision.round === round);
      return { score: score(decisions), samples: decisions.length, baseline: score(baseline) };
    });
    return {
      id, label, hands: entries.length, score: score(latest), samples: latest.length,
      timeline, axes, review: latest.findLast((decision) => !decision.correct),
    };
  }).sort((a, b) => b.hands - a.hands);
}
