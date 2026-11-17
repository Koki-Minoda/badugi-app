"""Opponent style summaries from completed-hand public opportunities only.

No hand identity or opponent private card is accepted. These summaries describe
observed frequencies; they are not a calibrated hand range or an action gate.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

FIELDS = {"handsObserved", "fold", "check", "call", "bet", "raise",
          "raiseAmountBbSum", "drawCounts", "facedBetOpportunities",
          "foldedFacingBet", "calledFacingBet", "raisedFacingBet",
          "freeBetOpportunities", "betWhenFree"}


@dataclass(frozen=True)
class PublicStyleEstimate:
    hands_observed: int
    faced_bets: int
    fold_when_facing_mean: float
    call_when_facing_mean: float
    raise_when_facing_mean: float
    raise_when_facing_half_width_99: float
    bet_when_free_mean: float
    pat_draw_mean: float
    average_raise_amount_bb: float | None
    enough_history_for_diagnosis: bool
    calibrated_for_action: bool = False


def _mean_and_half_width(successes, failures):
    alpha = successes + 1
    beta = failures + 1
    total = alpha + beta
    mean = alpha / total
    variance = alpha * beta / (total * total * (total + 1))
    return mean, min(1.0, 2.576 * math.sqrt(variance))


def estimate_public_style(history):
    if not isinstance(history, dict) or set(history) != FIELDS:
        raise ValueError("style requires the exact public-history fields")
    integers = FIELDS - {"raiseAmountBbSum", "drawCounts"}
    if any(type(history[key]) is not int or history[key] < 0 for key in integers):
        raise ValueError("style requires nonnegative public counts")
    draws = history["drawCounts"]
    if not isinstance(draws, list) or len(draws) != 5 or any(type(n) is not int or n < 0 for n in draws):
        raise ValueError("style requires five public draw-count bins")
    amount = history["raiseAmountBbSum"]
    if not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount < 0:
        raise ValueError("style requires a finite public raise amount")
    faced = history["facedBetOpportunities"]
    if (history["foldedFacingBet"] + history["calledFacingBet"] +
            history["raisedFacingBet"] != faced or
            history["betWhenFree"] > history["freeBetOpportunities"] or
            sum(draws) > 3 * history["handsObserved"] or
            history["raise"] < history["raisedFacingBet"] or
            (history["raise"] == 0 and amount != 0)):
        raise ValueError("style has inconsistent public opportunities")
    fold = (history["foldedFacingBet"] + 1) / (faced + 3)
    call = (history["calledFacingBet"] + 1) / (faced + 3)
    raise_mean, raise_half = _mean_and_half_width(history["raisedFacingBet"],
                                                  faced - history["raisedFacingBet"])
    bet_mean, _ = _mean_and_half_width(history["betWhenFree"],
                                       history["freeBetOpportunities"] - history["betWhenFree"])
    total_draws = sum(draws)
    pat_mean, _ = _mean_and_half_width(draws[0], total_draws - draws[0])
    return PublicStyleEstimate(
        history["handsObserved"], faced, fold, call, raise_mean, raise_half,
        bet_mean, pat_mean, amount / history["raise"] if history["raise"] else None,
        history["handsObserved"] >= 10 and faced >= 30 and raise_half <= 0.2)
