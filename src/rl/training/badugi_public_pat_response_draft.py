"""Candidate-only estimate of a player's public fold response after an opponent PAT.

Only completed-hand public action opportunities are accepted. This estimates
behavior, not the player's private hand range or the EV of a bluff. It cannot
authorize an action override without separate calibration and policy tests.
"""
from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class PublicPatResponseEstimate:
    pat_opportunities: int
    drawn_opportunities: int
    fold_after_pat_mean: float
    fold_after_draw_mean: float
    difference_mean: float
    difference_half_width_99: float
    enough_history_for_diagnosis: bool
    calibrated_for_action: bool = False

    @property
    def diagnostic_readiness_reason(self) -> str:
        if self.pat_opportunities < 30 or self.drawn_opportunities < 30:
            return "insufficient_matched_opportunities"
        if self.difference_half_width_99 > 0.2:
            return "uncertain_response_difference"
        return "ready"


def _beta_fold(folds: int, opportunities: int) -> tuple[float, float]:
    alpha = folds + 1
    beta = opportunities - folds + 1
    total = alpha + beta
    return alpha / total, alpha * beta / (total * total * (total + 1))


def estimate_public_pat_response(history: dict, *, street: int | None = None
                                 ) -> PublicPatResponseEstimate:
    """Compare public fold rates after PAT and after a non-PAT draw.

    The 99% half-width is a conservative normal approximation to the
    difference of two independent Beta(1,1) posteriors; it is descriptive and
    must be checked against held-out data before any strategy use.
    """
    if not isinstance(history, dict) or set(history) != {"byStreet"}:
        raise ValueError("PAT response requires exact public-history fields")
    by_street = history["byStreet"]
    if not isinstance(by_street, list) or len(by_street) != 3:
        raise ValueError("PAT response requires three betting streets")
    if street is not None and (type(street) is not int or street not in (1, 2, 3)):
        raise ValueError("PAT response requires a valid betting street")
    totals = {signal: {key: 0 for key in ("opportunities", "fold", "call", "raise")}
              for signal in ("pat", "draw")}
    for index, row in enumerate(by_street, start=1):
        if not isinstance(row, dict) or set(row) != {"pat", "draw"}:
            raise ValueError("PAT response requires exact public street fields")
        for signal in ("pat", "draw"):
            counts = row[signal]
            if (not isinstance(counts, dict) or set(counts) != set(totals[signal]) or
                    any(type(value) is not int or value < 0 for value in counts.values()) or
                    counts["opportunities"] != counts["fold"] + counts["call"] +
                    counts["raise"]):
                raise ValueError("PAT response has inconsistent public opportunities")
            if street is None or street == index:
                for key in totals[signal]:
                    totals[signal][key] += counts[key]
    pat = totals["pat"]
    drawn = totals["draw"]
    pat_mean, pat_var = _beta_fold(pat["fold"], pat["opportunities"])
    draw_mean, draw_var = _beta_fold(drawn["fold"], drawn["opportunities"])
    half_width = min(1.0, 2.576 * math.sqrt(pat_var + draw_var))
    estimate = PublicPatResponseEstimate(
        pat["opportunities"], drawn["opportunities"], pat_mean, draw_mean,
        pat_mean - draw_mean, half_width, False)
    return PublicPatResponseEstimate(
        estimate.pat_opportunities, estimate.drawn_opportunities,
        estimate.fold_after_pat_mean, estimate.fold_after_draw_mean,
        estimate.difference_mean, estimate.difference_half_width_99,
        estimate.diagnostic_readiness_reason == "ready")
