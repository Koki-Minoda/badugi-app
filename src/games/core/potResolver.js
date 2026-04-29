import {
  buildSplitShowdownSummary,
  getPotAwardContract,
  splitPotByComponents,
} from "./splitPotContract.js";

export function resolvePot({ variant, players, boards, evaluations, pot }) {
  const contract = getPotAwardContract(variant);
  const splitMode = contract.splitMode;

  // TODO: Connect side-pot accounting and winner selection per component.
  // The contract and componentPots fields are the stable integration points for
  // Badeucey, Badacey, Hidugi, Archie, board-by-board, and hi/lo variants.
  return {
    variantId: variant?.id ?? null,
    splitMode,
    contract,
    players,
    boards,
    evaluations,
    pot,
    componentPots:
      contract.components.length > 1 ? splitPotByComponents(pot, contract.components) : [],
    showdownSummary: buildSplitShowdownSummary({ variant, evaluations, pot }),
    awards: [],
  };
}
