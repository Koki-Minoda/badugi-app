import { assertCashFeedbackInvariant } from "./assertCashFeedbackInvariant.js";
import { assertTournamentFeedbackInvariant } from "./assertTournamentFeedbackInvariant.js";

export function assertFeedbackInvariant(summary = {}, context = {}) {
  return [
    ...assertCashFeedbackInvariant(summary, context),
    ...assertTournamentFeedbackInvariant(summary, context),
  ];
}

