import { assertCashOutInvariant } from "./assertCashOutInvariant.js";
import { assertTournamentMenuReturnInvariant } from "./assertTournamentMenuReturnInvariant.js";

export function assertMenuReturnInvariant(summary = {}, context = {}) {
  return [
    ...assertCashOutInvariant(summary, context),
    ...assertTournamentMenuReturnInvariant(summary, context),
  ];
}

