import { evaluateBadugi } from "../../games/badugi/utils/badugiEvaluator.js";

let currentRecord = null;
let seqCounter = 0;

function findSeatEntry(seat) {
  if (!currentRecord || typeof seat !== "number") return null;
  return currentRecord.seats?.find((entry) => entry.seat === seat) ?? null;
}

function clone(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

export function startHandHistoryRecord({ handId, dealer, level, seats, startedAt }) {
  currentRecord = {
    handId: handId ?? `unknown-${Date.now()}`,
    dealer: typeof dealer === "number" ? dealer : null,
    level: level ?? { sb: 0, bb: 0, ante: 0 },
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
}) {
  if (!currentRecord || typeof seat !== "number") return;
  const seatEntry = findSeatEntry(seat);
  if (!seatEntry) return;
  const normalizedStreet = (street ?? "BET").toUpperCase();
  const normalizedType = typeof type === "string" ? type.toLowerCase() : "unknown";
  seatEntry.actions.push({
    seq: ++seqCounter,
    street: normalizedStreet,
    type: normalizedType,
    amount: Math.round(amount ?? 0),
    totalInvested: Math.round(totalInvested ?? 0),
    timestamp: Date.now(),
    metadata: metadata ? clone(metadata) : undefined,
  });
}

export function updateHandHistorySeat(seat, updates = {}) {
  if (!currentRecord) return;
  const seatEntry = findSeatEntry(seat);
  if (!seatEntry) return;
  Object.assign(seatEntry, updates);
}

function buildPotEntries(pots = []) {
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
            const evaluation = entry?.evaluation ?? (entry?.hand ? evaluateBadugi(entry.hand) : null);
            return {
              seat,
              collect: Math.max(0, entry?.payout ?? 0),
              evaluation: evaluation ? clone(evaluation) : null,
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
        seatEntry.evaluation = clone(evaluateBadugi(hand));
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
