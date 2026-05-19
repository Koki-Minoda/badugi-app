const BADUGI_VARIANTS = new Set(["badugi", "d03"]);
const FIVE_CARD_DRAW_VARIANTS = new Set([
  "d01",
  "d02",
  "s01",
  "s02",
  "deuce_to_seven_triple_draw",
  "ace_to_five_triple_draw",
  "deuce_to_seven_single_draw",
  "ace_to_five_single_draw",
]);

function normalizeVariant(value) {
  if (value == null) return null;
  return String(value).trim().toLowerCase();
}

export function getExpectedHandCardCount(variantId) {
  const normalized = normalizeVariant(variantId);
  if (BADUGI_VARIANTS.has(normalized)) return 4;
  if (FIVE_CARD_DRAW_VARIANTS.has(normalized)) return 5;
  return null;
}

function candidateCardArrays(player = {}) {
  return [
    ["hand", player.hand],
    ["cards", player.cards],
    ["holeCards", player.holeCards],
  ].filter(([, cards]) => Array.isArray(cards));
}

function collectPlayers(snapshot = {}, players = null) {
  if (Array.isArray(players)) return players;
  if (Array.isArray(snapshot?.players)) return snapshot.players;
  if (Array.isArray(snapshot?.seatViews)) return snapshot.seatViews;
  return [];
}

export function collectHandShapeViolations({ variantId, snapshot = {}, players = null } = {}) {
  const expected = getExpectedHandCardCount(
    variantId ?? snapshot?.variantId ?? snapshot?.gameVariant ?? snapshot?.gameId,
  );
  if (!expected) return [];
  const seats = collectPlayers(snapshot, players);
  const violations = [];
  seats.forEach((player, seatIndex) => {
    if (!player) return;
    candidateCardArrays(player).forEach(([field, cards]) => {
      if (!cards.length) return;
      if (cards.length !== expected) {
        violations.push({
          type: "HAND_SHAPE_MISMATCH",
          severity: "P0",
          variantId,
          expectedCardCount: expected,
          actualCardCount: cards.length,
          seatIndex,
          field,
        });
      }
    });
  });
  return violations;
}

export function assertNoHandShapeContamination(audit = {}) {
  const violations = collectHandShapeViolations(audit);
  return {
    status: violations.length ? "FAIL" : "PASS",
    violations,
  };
}

export function isValidHandShapeForVariant(audit = {}) {
  return assertNoHandShapeContamination(audit).status === "PASS";
}

export function sanitizeSeatHandShapeForVariant(seat = {}, variantId = null) {
  const expected = getExpectedHandCardCount(variantId);
  if (!expected || !seat || typeof seat !== "object") return seat;
  const hand = Array.isArray(seat.hand) ? seat.hand : [];
  const cards = Array.isArray(seat.cards) ? seat.cards : hand;
  const holeCards = Array.isArray(seat.holeCards) ? seat.holeCards : [];
  const invalid =
    (hand.length > 0 && hand.length !== expected) ||
    (cards.length > 0 && cards.length !== expected) ||
    (holeCards.length > 0 && holeCards.length !== expected);
  if (!invalid) return seat;
  return {
    ...seat,
    hand: [],
    cards: [],
    holeCards: [],
    selected: [],
    handShapeRejected: true,
  };
}
