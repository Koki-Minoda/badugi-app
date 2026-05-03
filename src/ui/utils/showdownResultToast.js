export function buildShowdownToastItems(summary) {
  const potDetails = Array.isArray(summary?.potDetails) ? summary.potDetails : [];
  if (potDetails.length > 0) {
    return potDetails.slice(0, 3).map((pot, index) => {
      const winners = Array.isArray(pot?.winners) ? pot.winners : [];
      const winnerNames = winners
        .map((winner) => winner?.name)
        .filter(Boolean)
        .join(" / ");
      const label = potDetails.length <= 1 || index === 0 ? "Pot" : index === 1 ? "Side" : `Side ${index}`;
      return {
        key: `${pot?.potIndex ?? index}-${winnerNames}`,
        label,
        amount: pot?.potAmount ?? 0,
        winners: winnerNames || "-",
      };
    });
  }

  const winners = Array.isArray(summary?.winners) ? summary.winners : [];
  if (!winners.length) return [];
  return [
    {
      key: "pot",
      label: "Pot",
      amount: summary?.pot ?? 0,
      winners:
        winners
          .map((winner) => winner?.name)
          .filter(Boolean)
          .join(" / ") || "-",
    },
  ];
}
