export function resolvePot({ variant, players, boards, evaluations, pot }) {
  const splitMode = variant?.showdown?.splitMode;

  if (!["single", "byBoard", "hiLo"].includes(splitMode)) {
    throw new Error(`Unsupported splitMode: ${splitMode}`);
  }

  // TODO: Connect side-pot accounting, board-by-board awards, and hi/lo split rules.
  return {
    variantId: variant?.id ?? null,
    splitMode,
    players,
    boards,
    evaluations,
    pot,
    awards: [],
  };
}
