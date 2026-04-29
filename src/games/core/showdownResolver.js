import { buildSplitShowdownSummary, getPotAwardContract } from "./splitPotContract.js";

export function resolveShowdown({ variant, players, boards }) {
  const contract = getPotAwardContract(variant);
  const splitMode = contract.splitMode;

  // TODO: Dispatch to evaluator registry and return normalized per-player results.
  // Special draw variants consume contract.components to run separate Badugi,
  // lowball, high-badugi, or Archie component comparisons before pot awards.
  return {
    variantId: variant?.id ?? null,
    evaluator: variant?.showdown?.evaluator ?? null,
    splitMode,
    contract,
    players,
    boards,
    evaluations: [],
    showdownSummary: buildSplitShowdownSummary({ variant, evaluations: [], pot: 0 }),
  };
}
