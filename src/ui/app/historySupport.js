export function cloneHandHistory(value) {
  if (value == null) return null;
  try {
    const cloned = JSON.parse(JSON.stringify(value));
    if (
      process.env.NODE_ENV !== "production" &&
      cloned &&
      typeof cloned === "object"
    ) {
      Object.freeze(cloned);
    }
    return cloned;
  } catch (error) {
    console.warn("Failed to clone hand history snapshot", error);
    return null;
  }
}

export function formatHandIdentifier({
  tableId,
  handNumber,
  dealerSeat,
  timestamp = Date.now(),
}) {
  const tableSegment =
    typeof tableId === "string" && tableId.trim().length
      ? tableId.trim().replace(/\s+/g, "-")
      : "table";
  const sequenceSegment =
    Number.isFinite(handNumber) && handNumber >= 0
      ? `h${handNumber}`
      : `h${timestamp}`;
  const dealerSegment =
    Number.isFinite(dealerSeat) && dealerSeat >= 0 ? `d${dealerSeat}` : "dX";
  return `${tableSegment}-${sequenceSegment}-${dealerSegment}-${timestamp.toString(36)}`;
}

export function deriveHeroOutcome(record = {}, heroSeat = 0) {
  const hero = record.players?.[heroSeat];
  if (!hero) return null;
  const winners = Array.isArray(record.winners) ? record.winners : [];
  const heroWon = Boolean(hero.name && winners.includes(hero.name));
  const isSplit = heroWon && winners.length > 1;
  return {
    label: heroWon ? (isSplit ? "Split pot" : "Win") : hero.folded ? "Fold" : "Loss",
    value: heroWon ? (isSplit ? 0.5 : 1) : 0,
  };
}
