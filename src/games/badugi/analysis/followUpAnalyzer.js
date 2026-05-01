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

function getBetActionBeforeHand(action = {}) {
  return normalizeCards(
    action.metadata?.betInfo?.before ??
      action.metadata?.handBefore ??
      action.metadata?.beforeHand ??
      action.metadata?.hand,
  );
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

export function analyzeBadugiBetMistakes(record = {}, { heroOnly = true, raiseCap = 4 } = {}) {
  const variantId = record?.variantId ?? "badugi";
  if (variantId !== "badugi" && variantId !== "D03") return [];
  const seats = Array.isArray(record?.seats) ? record.seats : [];
  const issues = [];

  seats.forEach((seatEntry) => {
    if (heroOnly && seatEntry?.seat !== 0) return;
    const actions = Array.isArray(seatEntry?.actions) ? seatEntry.actions : [];
    actions
      .filter((action) => action?.street === "BET" || action?.street === "SHOWDOWN")
      .forEach((action) => {
        const actionType = String(action?.type ?? "").toLowerCase();
        if (!["call", "check", "bet", "raise"].includes(actionType)) return;
        const beforeHand = getBetActionBeforeHand(action);
        if (!beforeHand.length) return;
        const beforeEvaluation = evaluateBadugi(beforeHand);
        const betInfo = action.metadata?.betInfo ?? {};
        const toCall = Number(betInfo.toCall ?? action.metadata?.toCall ?? action.amount ?? 0);
        const raiseCountTable = Number(
          betInfo.raiseCountTable ?? action.metadata?.raiseCountTable ?? action.raiseCountTable ?? 0,
        );
        const capReached =
          betInfo.capReached === true ||
          action.metadata?.capReached === true ||
          raiseCountTable >= raiseCap;
        const canRaise = betInfo.canRaise !== false && !capReached;

        if (actionType === "call" && toCall > 0 && beforeEvaluation.count <= 2) {
          issues.push(
            buildIssue({
              type: "weak_call",
              seat: seatEntry.seat,
              action,
              beforeEvaluation,
              score: beforeEvaluation.count <= 1 ? 3 : 2,
              detail: `Called ${toCall} with ${beforeEvaluation.rankType}.`,
            }),
          );
        }
        if ((actionType === "check" || actionType === "call") && beforeEvaluation.count === 4 && canRaise) {
          issues.push(
            buildIssue({
              type: "missed_value_raise",
              seat: seatEntry.seat,
              action,
              beforeEvaluation,
              score: beforeEvaluation.kicker <= 7 ? 3 : 2,
              detail: `Strong Badugi was played passively (${actionType}).`,
            }),
          );
        }
        if ((actionType === "bet" || actionType === "raise") && beforeEvaluation.count <= 2) {
          issues.push(
            buildIssue({
              type: "unnecessary_bluff",
              seat: seatEntry.seat,
              action,
              beforeEvaluation,
              score: beforeEvaluation.count <= 1 ? 3 : 2,
              detail: `Aggressive action with ${beforeEvaluation.rankType}.`,
            }),
          );
        }
        if ((actionType === "bet" || actionType === "raise") && capReached) {
          issues.push(
            buildIssue({
              type: "cap_reached_raise",
              seat: seatEntry.seat,
              action,
              beforeEvaluation,
              score: 2,
              detail: `Attempted aggression after raise cap (${raiseCountTable}/${raiseCap}).`,
            }),
          );
        }
      });
  });

  return issues.sort((a, b) => b.score - a.score || (a.actionSeq ?? 0) - (b.actionSeq ?? 0));
}

export function buildPostMatchFollowUpSummary(record = {}, options = {}) {
  const drawIssues = analyzeBadugiDrawMistakes(record, options);
  const betIssues = analyzeBadugiBetMistakes(record, options);
  const allIssues = [...drawIssues, ...betIssues].sort(
    (a, b) => b.score - a.score || (a.actionSeq ?? 0) - (b.actionSeq ?? 0),
  );
  const topIssue = allIssues[0] ?? null;
  return {
    handId: record?.handId ?? null,
    issueCount: allIssues.length,
    highestSeverity: topIssue?.severity ?? "none",
    topIssue,
    drawIssues,
    betIssues,
    issues: allIssues,
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
