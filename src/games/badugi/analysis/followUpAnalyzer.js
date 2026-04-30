import { evaluateBadugi } from "../utils/badugiEvaluator.js";

export const FOLLOW_UP_THRESHOLDS = Object.freeze({
  minor: 1,
  medium: 2,
  high: 3,
});

function normalizeCards(cards = []) {
  return Array.isArray(cards) ? cards.map((card) => String(card).toUpperCase()) : [];
}

function getActionBeforeHand(action = {}) {
  const drawInfo = action.metadata?.drawInfo ?? {};
  return normalizeCards(drawInfo.before);
}

function getDiscardedIndexes(action = {}) {
  const indexes = action.discarded ?? action.metadata?.drawInfo?.drawIndexes ?? [];
  return Array.isArray(indexes)
    ? indexes.filter((index) => Number.isInteger(index) && index >= 0)
    : [];
}

function getDiscardedCards(action = {}, beforeHand = []) {
  const replacedCards = action.replacedCards ?? action.metadata?.drawInfo?.replacedCards ?? [];
  if (Array.isArray(replacedCards) && replacedCards.length) {
    return normalizeCards(replacedCards.map((entry) => entry?.oldCard).filter(Boolean));
  }
  return getDiscardedIndexes(action)
    .map((index) => beforeHand[index])
    .filter(Boolean);
}

function severityFromScore(score) {
  if (score >= FOLLOW_UP_THRESHOLDS.high) return "high";
  if (score >= FOLLOW_UP_THRESHOLDS.medium) return "medium";
  return "low";
}

function buildIssue({ type, seat, action, beforeEvaluation, detail, score }) {
  return {
    type,
    seat,
    actionSeq: action.seq ?? null,
    street: action.street ?? null,
    severity: severityFromScore(score),
    score,
    beforeRankType: beforeEvaluation.rankType,
    detail,
  };
}

export function analyzeBadugiDrawMistakes(record = {}, { heroOnly = true } = {}) {
  const variantId = record?.variantId ?? "badugi";
  if (variantId !== "badugi" && variantId !== "D03") return [];
  const seats = Array.isArray(record?.seats) ? record.seats : [];
  const issues = [];

  seats.forEach((seatEntry) => {
    if (heroOnly && seatEntry?.seat !== 0) return;
    const actions = Array.isArray(seatEntry?.actions) ? seatEntry.actions : [];
    actions
      .filter((action) => action?.type === "draw" || action?.street === "DRAW")
      .forEach((action) => {
        const beforeHand = getActionBeforeHand(action);
        if (!beforeHand.length) return;
        const beforeEvaluation = evaluateBadugi(beforeHand);
        const deadCards = normalizeCards(beforeEvaluation.deadCards);
        const discardedCards = getDiscardedCards(action, beforeHand);
        const drawCount =
          Number.isInteger(action.drawCount) ? action.drawCount : discardedCards.length;
        const retainedDeadCards = deadCards.filter((card) => !discardedCards.includes(card));

        if (beforeEvaluation.count === 4 && drawCount > 0) {
          issues.push(
            buildIssue({
              type: "made_badugi_broken",
              seat: seatEntry.seat,
              action,
              beforeEvaluation,
              score: 3,
              detail: "A made Badugi was broken during the draw.",
            }),
          );
        }
        if (retainedDeadCards.length > 0) {
          issues.push(
            buildIssue({
              type: "dead_card_retained",
              seat: seatEntry.seat,
              action,
              beforeEvaluation,
              score: retainedDeadCards.length >= 2 ? 3 : 2,
              detail: `Dead card retained: ${retainedDeadCards.join(", ")}`,
            }),
          );
        }
        if (drawCount > deadCards.length) {
          issues.push(
            buildIssue({
              type: "overdraw",
              seat: seatEntry.seat,
              action,
              beforeEvaluation,
              score: drawCount - deadCards.length >= 2 ? 3 : 2,
              detail: `Drew ${drawCount} with ${deadCards.length} dead card(s).`,
            }),
          );
        }
        if (deadCards.length > 0 && drawCount < deadCards.length) {
          issues.push(
            buildIssue({
              type: "underdraw",
              seat: seatEntry.seat,
              action,
              beforeEvaluation,
              score: deadCards.length - drawCount >= 2 ? 3 : 2,
              detail: `Drew ${drawCount} while ${deadCards.length} dead card(s) were available.`,
            }),
          );
        }
      });
  });

  return issues.sort((a, b) => b.score - a.score || (a.actionSeq ?? 0) - (b.actionSeq ?? 0));
}

export function buildPostMatchFollowUpSummary(record = {}, options = {}) {
  const drawIssues = analyzeBadugiDrawMistakes(record, options);
  const topIssue = drawIssues[0] ?? null;
  return {
    handId: record?.handId ?? null,
    issueCount: drawIssues.length,
    highestSeverity: topIssue?.severity ?? "none",
    topIssue,
    drawIssues,
    replayTarget:
      topIssue && record?.handId
        ? {
            handId: record.handId,
            actionSeq: topIssue.actionSeq,
            seat: topIssue.seat,
          }
        : null,
  };
}
