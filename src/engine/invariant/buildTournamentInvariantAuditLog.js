import { assertBustOutInvariant } from "./assertBustOutInvariant.js";
import { assertChampionInvariant } from "./assertChampionInvariant.js";
import { assertPayoutInvariant } from "./assertPayoutInvariant.js";
import { assertTableRebalanceInvariant } from "./assertTableRebalanceInvariant.js";
import { assertTournamentFeedbackInvariant } from "./assertTournamentFeedbackInvariant.js";
import { assertTournamentLifecycleInvariant } from "./assertTournamentLifecycleInvariant.js";
import { assertTournamentMenuReturnInvariant } from "./assertTournamentMenuReturnInvariant.js";

export function buildTournamentInvariantAuditLog(rows = []) {
  return rows.map((row) => {
    const context = { variantId: row.variant, mode: "tournament" };
    const violations = [
      ...assertTournamentLifecycleInvariant(row, context),
      ...assertBustOutInvariant(row, context),
      ...assertChampionInvariant(row, context),
      ...assertPayoutInvariant(row, context),
      ...assertTableRebalanceInvariant(row, context),
      ...assertTournamentFeedbackInvariant(row, context),
      ...assertTournamentMenuReturnInvariant(row, context),
    ];
    return { ...row, mode: "tournament", invariantViolations: violations.length, violations };
  });
}

