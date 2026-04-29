const BOARD_IDS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function isDoubleBoardVariant(variant) {
  return Boolean(
    variant?.boards?.count >= 2 || variant?.modifiers?.includes("doubleBoard"),
  );
}

export function createBoards(variant) {
  const count = variant?.boards?.count ?? 1;
  return Array.from({ length: count }, (_, index) => ({
    id: BOARD_IDS[index] ?? String(index + 1),
    cards: [],
  }));
}

export function getBoardById(boards, boardId) {
  if (!Array.isArray(boards)) return null;
  return boards.find((board) => board.id === boardId) ?? null;
}

function cardsNeededForStreet(street) {
  if (street === "flop") return 3;
  if (street === "turn" || street === "river") return 1;
  return 0;
}

function takeCards(deckOrCards, count) {
  if (Array.isArray(deckOrCards)) {
    return deckOrCards.splice(0, count);
  }
  if (typeof deckOrCards?.draw === "function") {
    return deckOrCards.draw(count);
  }
  if (typeof deckOrCards?.deal === "function") {
    return Array.from({ length: count }, () => deckOrCards.deal()).filter(Boolean);
  }
  return [];
}

export function dealToBoards(boards, street, deckOrCards) {
  if (!Array.isArray(boards)) {
    throw new Error("boards must be an array");
  }

  const count = cardsNeededForStreet(street);
  if (count === 0) {
    // TODO: Wire variant-specific board street definitions when board engines are integrated.
    return boards.map((board) => ({ ...board, cards: [...(board.cards ?? [])] }));
  }

  return boards.map((board) => {
    // TODO: Integrate with the shared deck manager once non-Badugi board engines consume this helper.
    const cards = takeCards(deckOrCards, count);
    if (cards.length !== count) {
      throw new Error(`Not enough cards to deal ${street} to board ${board.id}`);
    }
    return {
      ...board,
      cards: [...(board.cards ?? []), ...cards],
    };
  });
}
