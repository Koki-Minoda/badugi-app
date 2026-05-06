const COMPONENT_LABELS = {
  badugi: "Badugi half",
  low27: "2-7 Low half",
  lowA5: "A-5 Low half",
  archieHigh: "High half",
  archieLow: "A-5 Low half",
  board: "High / Board half",
  draw: "Draw half",
};

function getComponentLabel(pot = {}) {
  if (pot.component && COMPONENT_LABELS[pot.component]) return COMPONENT_LABELS[pot.component];
  if (pot.componentLabel) return pot.componentLabel;
  if (pot.label && /\bhalf\b/i.test(pot.label)) return pot.label;
  return null;
}

function getBasePotLabel(pot = {}, index, totalPots) {
  const sourcePotIndex = Number.isInteger(pot.sourcePotIndex) ? pot.sourcePotIndex : index;
  if (totalPots <= 1 && !getComponentLabel(pot)) return "Pot";
  if (sourcePotIndex === 0) return "Pot";
  if (sourcePotIndex === 1) return "Side";
  return `Side ${sourcePotIndex}`;
}

function getToastPotLabel(pot = {}, index, totalPots) {
  const baseLabel = getBasePotLabel(pot, index, totalPots);
  const componentLabel = getComponentLabel(pot);
  return componentLabel ? `${baseLabel} · ${componentLabel}` : baseLabel;
}

export function buildShowdownToastItems(summary) {
  const potDetails = Array.isArray(summary?.potDetails) ? summary.potDetails : [];
  if (potDetails.length > 0) {
    return potDetails.slice(0, 3).map((pot, index) => {
      const winners = Array.isArray(pot?.winners) ? pot.winners : [];
      const winnerNames = winners
        .map((winner) => winner?.name)
        .filter(Boolean)
        .join(" / ");
      return {
        key: `${pot?.potIndex ?? index}-${winnerNames}`,
        label: getToastPotLabel(pot, index, potDetails.length),
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
