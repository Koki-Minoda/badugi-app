const BASE_REQUIRED_TOP_LEVEL_FIELDS = ["handId", "seats", "pots"];
const BASE_REQUIRED_SEAT_FIELDS = ["seat", "name", "startStack", "endStack", "actions"];
const BASE_REQUIRED_ACTION_FIELDS = ["seq", "street", "type"];
const BASE_REQUIRED_POT_FIELDS = ["potId", "amount", "winners"];
const BASE_REQUIRED_WINNER_FIELDS = ["seat", "collect"];

const D01_REQUIRED_TOP_LEVEL_FIELDS = ["variantId", "variantName"];
const D01_REQUIRED_DRAW_ACTION_FIELDS = [
  "drawCount",
  "discarded",
  "keptCards",
  "replacedCards",
];
const D01_REQUIRED_RESULT_FIELDS = ["handLabel", "finalLowRanks"];

function normalizeVariantId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "badugi";
}

function isD01Variant(variantId) {
  const normalized = normalizeVariantId(variantId);
  return normalized === "D01" || normalized === "deuce_to_seven_triple_draw";
}

function hasField(target, field) {
  if (!target || typeof target !== "object") return false;
  return target[field] !== undefined && target[field] !== null;
}

function pushMissing(missing, path, fields, target) {
  fields.forEach((field) => {
    if (!hasField(target, field)) {
      missing.push(`${path}.${field}`);
    }
  });
}

export function getHandHistoryReplayRequirements(variantId = "badugi") {
  const d01 = isD01Variant(variantId);
  return {
    variantId: normalizeVariantId(variantId),
    topLevel: d01
      ? [...BASE_REQUIRED_TOP_LEVEL_FIELDS, ...D01_REQUIRED_TOP_LEVEL_FIELDS]
      : [...BASE_REQUIRED_TOP_LEVEL_FIELDS],
    seat: [...BASE_REQUIRED_SEAT_FIELDS],
    action: [...BASE_REQUIRED_ACTION_FIELDS],
    drawAction: d01 ? [...BASE_REQUIRED_ACTION_FIELDS, ...D01_REQUIRED_DRAW_ACTION_FIELDS] : [],
    pot: [...BASE_REQUIRED_POT_FIELDS],
    winner: d01
      ? [...BASE_REQUIRED_WINNER_FIELDS, ...D01_REQUIRED_RESULT_FIELDS]
      : [...BASE_REQUIRED_WINNER_FIELDS],
    finalSeatResult: d01 ? [...D01_REQUIRED_RESULT_FIELDS] : [],
  };
}

export function validateReplayReadyHandHistory(record, { variantId = record?.variantId } = {}) {
  const requirements = getHandHistoryReplayRequirements(variantId);
  const d01 = isD01Variant(requirements.variantId);
  const missing = [];

  pushMissing(missing, "record", requirements.topLevel, record);

  const seats = Array.isArray(record?.seats) ? record.seats : [];
  seats.forEach((seat, seatIndex) => {
    pushMissing(missing, `record.seats[${seatIndex}]`, requirements.seat, seat);
    const actions = Array.isArray(seat?.actions) ? seat.actions : [];
    actions.forEach((action, actionIndex) => {
      const isDraw = String(action?.type ?? "").toLowerCase() === "draw";
      pushMissing(
        missing,
        `record.seats[${seatIndex}].actions[${actionIndex}]`,
        isDraw && d01 ? requirements.drawAction : requirements.action,
        action,
      );
    });
    if (d01 && Array.isArray(seat?.hand) && seat.hand.length) {
      pushMissing(missing, `record.seats[${seatIndex}]`, requirements.finalSeatResult, seat);
    }
  });

  const pots = Array.isArray(record?.pots) ? record.pots : [];
  pots.forEach((pot, potIndex) => {
    pushMissing(missing, `record.pots[${potIndex}]`, requirements.pot, pot);
    const winners = Array.isArray(pot?.winners) ? pot.winners : [];
    winners.forEach((winner, winnerIndex) => {
      pushMissing(
        missing,
        `record.pots[${potIndex}].winners[${winnerIndex}]`,
        requirements.winner,
        winner,
      );
    });
  });

  return {
    valid: missing.length === 0,
    missing,
    requirements,
  };
}
