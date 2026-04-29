import { evaluateBadugi } from "../../games/badugi/utils/badugiEvaluator.js";
import { evaluateLowHand, formatLowHandLabel } from "../../games/evaluators/low.js";

let currentRecord = null;
let seqCounter = 0;

function findSeatEntry(seat) {
  if (!currentRecord || typeof seat !== "number") return null;
  return currentRecord.seats?.find((entry) => entry.seat === seat) ?? null;
}

function clone(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

function normalizeVariantId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "badugi";
}

function isDeuceToSevenVariant(variantId) {
  const normalized = normalizeVariantId(variantId);
  return normalized === "D01" || normalized === "deuce_to_seven_triple_draw";
}

function evaluateVariantHand(hand = [], variantId = "badugi") {
  if (isDeuceToSevenVariant(variantId)) {
    const evaluation = evaluateLowHand({ cards: hand, lowType: "27" });
    return {
      ...evaluation,
      handName: formatLowHandLabel(evaluation, { lowType: "27" }),
    };
  }
  return evaluateBadugi(hand);
}

function getEvaluationLabel(evaluation, variantId = "badugi") {
  if (!evaluation) return null;
  if (evaluation.handName) return evaluation.handName;
  if (isDeuceToSevenVariant(variantId)) {
    return formatLowHandLabel(evaluation, { lowType: "27" });
  }
  return null;
}

export function startHandHistoryRecord({
  handId,
  dealer,
  level,
  seats,
  startedAt,
  userId = null,
  variantId = "badugi",
  variantName = null,
}) {
  // userId allows the backend to associate logs with a specific player but
  // remains optional so offline sessions continue to work.
  currentRecord = {
    handId: handId ?? `unknown-${Date.now()}`,
    variantId: normalizeVariantId(variantId),
    variantName: variantName ?? null,
    dealer: typeof dealer === "number" ? dealer : null,
    level: level ?? { sb: 0, bb: 0, ante: 0 },
    userId: userId ?? null,
    seats: Array.isArray(seats)
      ? seats.map((seat) => ({
          seat: seat?.seat ?? seat?.seatIndex ?? 0,
          name: seat?.name ?? `Seat ${seat?.seat ?? seat?.seatIndex ?? 0}`,
          startStack: seat?.startStack ?? 0,
          endStack: seat?.startStack ?? 0,
          finalAction: null,
          actions: [],
          hand: null,
          evaluation: null,
        }))
      : [],
    pots: [],
    uiSummary: null,
    startedAt: startedAt ?? Date.now(),
    endedAt: null,
  };
  seqCounter = 0;
  return currentRecord;
}

export function appendHandHistoryAction({
  seat,
  street,
  type,
  amount = 0,
  totalInvested = 0,
  metadata,
  userId = null,
}) {
  if (!currentRecord || typeof seat !== "number") return;
  const seatEntry = findSeatEntry(seat);
  if (!seatEntry) return;
  const normalizedStreet = (street ?? "BET").toUpperCase();
  const normalizedType = typeof type === "string" ? type.toLowerCase() : "unknown";
  const drawInfo = metadata?.drawInfo;
  const drawCount = Number.isInteger(drawInfo?.drawCount)
    ? drawInfo.drawCount
    : Array.isArray(drawInfo?.drawIndexes)
    ? drawInfo.drawIndexes.length
    : Array.isArray(drawInfo?.replacedCards)
    ? drawInfo.replacedCards.length
    : undefined;
  seatEntry.actions.push({
    seq: ++seqCounter,
    street: normalizedStreet,
    type: normalizedType,
    amount: Math.round(amount ?? 0),
    totalInvested: Math.round(totalInvested ?? 0),
    drawCount,
    discarded: Array.isArray(drawInfo?.drawIndexes) ? [...drawInfo.drawIndexes] : undefined,
    replacedCards: Array.isArray(drawInfo?.replacedCards)
      ? clone(drawInfo.replacedCards)
      : undefined,
    keptCards: Array.isArray(drawInfo?.keptCards) ? [...drawInfo.keptCards] : undefined,
    timestamp: Date.now(),
    metadata: metadata ? clone(metadata) : undefined,
    userId: userId ?? currentRecord?.userId ?? null,
  });
}

export function updateHandHistorySeat(seat, updates = {}) {
  if (!currentRecord) return;
  const seatEntry = findSeatEntry(seat);
  if (!seatEntry) return;
  Object.assign(seatEntry, updates);
}

function buildPotEntries(pots = []) {
  const variantId = currentRecord?.variantId ?? "badugi";
  return pots.map((pot, idx) => {
    const potIndex = typeof pot?.potIndex === "number" ? pot.potIndex : idx;
    return {
      potId: potIndex,
      amount: Math.max(0, pot?.potAmount ?? pot?.amount ?? 0),
      eligibleSeats: Array.isArray(pot?.eligible)
        ? pot.eligible.map((seat) => (typeof seat === "number" ? seat : null)).filter(
            (seat) => seat !== null,
          )
        : [],
      winners: Array.isArray(pot?.payouts)
        ? pot.payouts.map((entry) => {
            const seat =
              typeof entry?.seat === "number"
                ? entry.seat
                : typeof entry?.seatIndex === "number"
                ? entry.seatIndex
                : null;
            const evaluation =
              entry?.evaluation ?? (entry?.hand ? evaluateVariantHand(entry.hand, variantId) : null);
            return {
              seat,
              collect: Math.max(0, entry?.payout ?? 0),
              evaluation: evaluation ? clone(evaluation) : null,
              handLabel:
                entry?.handLabel ??
                entry?.handName ??
                getEvaluationLabel(evaluation, variantId),
              finalLowRanks:
                Array.isArray(entry?.finalLowRanks)
                  ? [...entry.finalLowRanks]
                  : isDeuceToSevenVariant(variantId) && Array.isArray(evaluation?.metadata?.ranks)
                  ? [...evaluation.metadata.ranks]
                  : undefined,
            };
          })
        : [],
    };
  });
}

export function finalizeHandHistoryRecord({ players = [], pots = [], uiSummary = null, endedAt }) {
  if (!currentRecord) return null;
  currentRecord.pots = buildPotEntries(pots);
  currentRecord.uiSummary = uiSummary ? clone(uiSummary) : null;
  currentRecord.endedAt = endedAt ?? Date.now();

  const winnerSeats = new Set();
  currentRecord.pots.forEach((pot) => {
    pot.winners.forEach((winner) => {
      if (typeof winner.seat === "number") {
        winnerSeats.add(winner.seat);
      }
    });
  });

  currentRecord.seats.forEach((seatEntry, idx) => {
    const player = players[idx] ?? null;
    if (player) {
      seatEntry.endStack = player.stack ?? seatEntry.endStack;
      const hand = Array.isArray(player.hand) ? [...player.hand] : null;
      if (hand && hand.length) {
        seatEntry.hand = hand;
        seatEntry.evaluation = clone(evaluateVariantHand(hand, currentRecord.variantId));
        seatEntry.handLabel = getEvaluationLabel(seatEntry.evaluation, currentRecord.variantId);
        if (
          isDeuceToSevenVariant(currentRecord.variantId) &&
          Array.isArray(seatEntry.evaluation?.metadata?.ranks)
        ) {
          seatEntry.finalLowRanks = [...seatEntry.evaluation.metadata.ranks];
        }
      }
      if (player.folded) {
        seatEntry.finalAction = seatEntry.finalAction ?? "fold";
      } else if (winnerSeats.has(idx)) {
        const winnerCount = currentRecord.pots.reduce(
          (sum, pot) => sum + pot.winners.filter((w) => w.seat === idx).length,
          0,
        );
        seatEntry.finalAction = winnerCount > 1 ? "split" : "win";
      } else if (!seatEntry.finalAction) {
        seatEntry.finalAction = hand ? "showdown" : "win";
      }
    } else if (!seatEntry.finalAction) {
      seatEntry.finalAction = winnerSeats.has(seatEntry.seat) ? "win" : "fold";
    }
  });

  return currentRecord;
}

export function getCurrentHandHistoryRecord() {
  return currentRecord;
}

export function resetHandHistoryRecord() {
  currentRecord = null;
  seqCounter = 0;
}
