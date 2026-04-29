export function resolveShowdown({ variant, players, boards }) {
  const splitMode = variant?.showdown?.splitMode;

  if (!["single", "byBoard", "hiLo"].includes(splitMode)) {
    throw new Error(`Unsupported splitMode: ${splitMode}`);
  }

  // TODO: Dispatch to evaluator registry and return normalized per-player results.
  return {
    variantId: variant?.id ?? null,
    evaluator: variant?.showdown?.evaluator ?? null,
    splitMode,
    players,
    boards,
    evaluations: [],
  };
}
